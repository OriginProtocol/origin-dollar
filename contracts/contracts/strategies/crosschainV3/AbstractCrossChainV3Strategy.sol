// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { Governable } from "../../governance/Governable.sol";
import { IBridgeAdapter } from "../../interfaces/crosschainV3/IBridgeAdapter.sol";
import { IBridgeReceiver } from "../../interfaces/crosschainV3/IBridgeReceiver.sol";
import { CrossChainV3Helper } from "./CrossChainV3Helper.sol";

/**
 * @title AbstractCrossChainV3Strategy
 * @author Origin Protocol Inc
 *
 * @notice Shared base for OUSD V3 Master (L2) and Remote (Ethereum) strategies. Provides:
 *           - Bridge-agnostic outbound / inbound adapter wiring.
 *           - Yield-channel nonce machinery (one yield op in flight at a time).
 *           - Inbound `receiveMessage` entry point with adapter-only access control,
 *             dispatching to a single hook the concrete strategy implements.
 *           - A single outbound `_send` helper that packs `(msgType, nonce, body)` into the
 *             strategy-owned payload, quotes the adapter fee, and forwards exact native via
 *             `msg.value`. Excess is NOT refunded — overpayment joins the fee pool (recover
 *             via `transferNative`).
 *
 *         The abstract does NOT itself inherit `InitializableAbstractStrategy` — it stays
 *         small and composable. Concrete Master / Remote contracts mix in
 *         `InitializableAbstractStrategy` separately.
 */
abstract contract AbstractCrossChainV3Strategy is Governable, IBridgeReceiver {
    using SafeERC20 for IERC20;

    // --- Events -------------------------------------------------------------

    event OutboundAdapterUpdated(address oldAdapter, address newAdapter);
    event InboundAdapterUpdated(address oldAdapter, address newAdapter);
    event OperatorUpdated(address oldOperator, address newOperator);
    event YieldNonceAdvanced(uint64 nonce);
    event YieldNonceProcessed(uint64 nonce);

    // --- Storage (all new slots; nothing relocated from any parent) ---------

    /// @notice Adapter used to send outbound messages and tokens to the peer chain.
    address public outboundAdapter;

    /// @notice Adapter authorised to call `receiveMessage` on this strategy.
    ///         For atomic bridges the outbound and inbound adapters can be the same address;
    ///         for split-delivery they're typically different.
    address public inboundAdapter;

    /// @notice Account allowed to drive periodic, permissioned operations
    ///         (balance check, settlement, claim trigger). Set by governor.
    address public operator;

    /// @notice Highest yield-channel nonce ever assigned.
    uint64 public lastYieldNonce;

    /// @notice Marks each yield-channel nonce as processed (true) once its
    ///         message round-trip completes.
    mapping(uint64 => bool) public nonceProcessed;

    /// @notice Timestamp echoed back from the most-recently-accepted balance check ack.
    ///         Used by `_processBalanceCheckResponse` to enforce strict monotonic ordering
    ///         when multiple balance checks are in flight at the same yield-nonce window
    ///         and responses can arrive out of order (CCIP delivery isn't FIFO).
    // slither-disable-next-line constable-states
    uint256 public lastBalanceCheckTimestamp;

    /// @dev Reserved for future expansion of this abstract layer.
    uint256[43] private __gap;

    // --- Modifiers ----------------------------------------------------------

    modifier onlyInboundAdapter() {
        require(
            inboundAdapter != address(0) && msg.sender == inboundAdapter,
            "V3: only inbound adapter"
        );
        _;
    }

    // --- Adapter / operator configuration (governor) ------------------------

    function setOutboundAdapter(address _outboundAdapter)
        external
        onlyGovernor
    {
        _setOutboundAdapter(_outboundAdapter);
    }

    /**
     * @dev Hook for concrete strategies that need to perform token-allowance swaps when
     *      the outbound adapter changes (e.g., revoke an old adapter's bridgeAsset
     *      allowance, grant the new one max). Default implementation just rotates the
     *      stored address; override to add side effects.
     */
    function _setOutboundAdapter(address _outboundAdapter) internal virtual {
        emit OutboundAdapterUpdated(outboundAdapter, _outboundAdapter);
        outboundAdapter = _outboundAdapter;
    }

    function setInboundAdapter(address _inboundAdapter) external onlyGovernor {
        emit InboundAdapterUpdated(inboundAdapter, _inboundAdapter);
        inboundAdapter = _inboundAdapter;
    }

    function setOperator(address _operator) external onlyGovernor {
        emit OperatorUpdated(operator, _operator);
        operator = _operator;
    }

    // --- Yield-channel nonce machinery --------------------------------------

    /**
     * @dev True when a yield-channel operation has been initiated but its ack
     *      has not yet been processed.
     */
    function isYieldOpInFlight() public view returns (bool) {
        uint64 n = lastYieldNonce;
        if (n == 0) return false;
        return !nonceProcessed[n];
    }

    function _getNextYieldNonce() internal returns (uint64) {
        require(!isYieldOpInFlight(), "V3: yield op already in flight");
        lastYieldNonce += 1;
        emit YieldNonceAdvanced(lastYieldNonce);
        return lastYieldNonce;
    }

    /**
     * @dev Called by the initiating side (typically Master) when an ack lands. Requires the
     *      nonce to match the most recently issued one and not yet be marked processed.
     */
    function _markYieldNonceProcessed(uint64 nonce) internal {
        require(nonce == lastYieldNonce, "V3: stale or unknown nonce");
        require(!nonceProcessed[nonce], "V3: nonce already processed");
        nonceProcessed[nonce] = true;
        emit YieldNonceProcessed(nonce);
    }

    /**
     * @dev Called by the receiving side (typically Remote) when an inbound yield-channel
     *      message arrives. The receiver doesn't issue nonces of its own; it adopts the
     *      sender's nonce, enforcing strict monotonicity and one-time processing.
     */
    function _acceptYieldNonce(uint64 nonce) internal {
        require(nonce > lastYieldNonce, "V3: nonce not monotonic");
        require(!nonceProcessed[nonce], "V3: nonce already processed");
        lastYieldNonce = nonce;
        nonceProcessed[nonce] = true;
        emit YieldNonceProcessed(nonce);
    }

    // --- Inbound dispatch ---------------------------------------------------

    /**
     * @inheritdoc IBridgeReceiver
     * @dev Single ingress for all inbound bridge deliveries. Validates the caller is the
     *      configured inbound adapter, decodes the strategy-owned `(msgType, nonce, body)`
     *      from `payload`, and forwards to the concrete strategy's hook. The reentrancy guard
     *      lives on the bridge-channel inbound (`_handleInboundBridgeMessage`) — the only
     *      inbound path that makes an UNTRUSTED external call (the optional post-delivery
     *      callback). Yield acks touch only trusted vault / wrapper contracts, so guarding
     *      them is unnecessary; keeping the guard off `receiveMessage` also lets a synchronous
     *      (same-tx) yield round-trip complete without a self-reentrancy false trip (relevant
     *      only to tests — production bridge delivery is always a separate tx).
     */
    function receiveMessage(
        address sender,
        address token,
        uint256 amountReceived,
        uint256 feePaid,
        bytes calldata payload
    ) external override onlyInboundAdapter {
        (uint32 msgType, uint64 nonce, bytes memory body) = CrossChainV3Helper
            .unpackPayload(payload);
        _handleBridgeMessage(
            sender,
            token,
            amountReceived,
            feePaid,
            msgType,
            nonce,
            body
        );
    }

    /**
     * @dev Concrete strategies (Master / Remote) override this to dispatch by `msgType` and
     *      implement the per-message logic. `body` is the message-specific payload (e.g.,
     *      `abi.encode(newBalance)` for DEPOSIT_ACK).
     */
    function _handleBridgeMessage(
        address sender,
        address token,
        uint256 amountReceived,
        uint256 feePaid,
        uint32 msgType,
        uint64 nonce,
        bytes memory body
    ) internal virtual;

    // --- Outbound helper ----------------------------------------------------
    //
    // One send path, parameterised by `userFunded`:
    //   userFunded = true  → user-initiated sends (bridgeOTokenToPeer). msg.value MUST cover
    //                        the fee; the pool is NOT consulted. Security gate: stops an
    //                        attacker draining the operator-funded pool by spamming bridge
    //                        in/out with msg.value = 0.
    //   userFunded = false → operator/protocol-funded sends (yield deposits/withdraws/claims
    //                        and the acks Remote sends back). Fee paid from
    //                        `address(this).balance`, which already absorbs any attached
    //                        msg.value via `receive()`.
    //
    // `token == address(0)` selects the message-only path; otherwise tokens ride along.
    // Excess msg.value is NEVER refunded — overpayment joins the strategy's pool (recover via
    // `transferNative`, governor only). Callers quote exactly via `IBridgeAdapter.quoteFee`.
    function _send(
        address token,
        uint256 amount,
        uint32 msgType,
        uint64 nonce,
        bytes memory body,
        bool userFunded
    ) internal {
        bytes memory payload = CrossChainV3Helper.packPayload(
            msgType,
            nonce,
            body
        );
        address adapter = outboundAdapter;
        (
            uint256 fee,
            address feeToken,
            bool requiresExternalPayment
        ) = IBridgeAdapter(adapter).quoteFee(token, amount, payload);
        if (requiresExternalPayment) {
            // Only native fee supported today. ERC20 fee tokens (e.g., LINK-mode CCIP)
            // would need explicit allowance handling; not implemented here.
            require(feeToken == address(0), "V3: only native fee supported");
            require(
                (userFunded ? msg.value : address(this).balance) >= fee,
                userFunded ? "V3: insufficient user fee" : "V3: pool unfunded"
            );
            // slither-disable-next-line arbitrary-send-eth
            if (token == address(0)) {
                IBridgeAdapter(adapter).sendMessage{ value: fee }(payload);
            } else {
                IBridgeAdapter(adapter).sendMessageAndTokens{ value: fee }(
                    token,
                    amount,
                    payload
                );
            }
        } else {
            // CCTP-style: protocol auto-deducts from the bridged amount; no caller action.
            if (token == address(0)) {
                IBridgeAdapter(adapter).sendMessage(payload);
            } else {
                IBridgeAdapter(adapter).sendMessageAndTokens(
                    token,
                    amount,
                    payload
                );
            }
        }
    }

    /// @notice Sweep native ETH out of the strategy to governor. Used to drain the fee
    ///         pool (operator rotation, decommission) or recover stray donations (a user
    ///         that overpaid msg.value when calling `bridgeOTokenToPeer`).
    function transferNative(uint256 amount) external onlyGovernor {
        // slither-disable-next-line low-level-calls
        (bool ok, ) = governor().call{ value: amount }("");
        require(ok, "V3: native sweep failed");
    }

    /// @dev Strategy accepts native ETH unconditionally. Lands in `address(this).balance`
    ///      and serves as the fee pool. NEVER counted toward `checkBalance` — that function
    ///      only sums bridge-asset-denominated slots, so ETH on this contract is naturally
    ///      invisible to the L2 vault's accounting. (No explicit "exclude ETH" code needed.)
    receive() external payable virtual {}
}

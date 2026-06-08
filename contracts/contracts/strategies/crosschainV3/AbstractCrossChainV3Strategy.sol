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
 *           - Outbound helpers (`_sendYieldMessage`, `_sendYieldTokensAndMessage`,
 *             `_sendMessage`) that pack `(msgType, nonce, body)` into the strategy-owned
 *             payload, quote the adapter fee, forward exact native via `msg.value`, and
 *             refund any excess back to the caller (user / operator).
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
     *      from `payload`, and forwards to the concrete strategy's hook. No `nonReentrant`
     *      here — the concrete strategy's hook is the right place to apply it.
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

    // --- Outbound helpers ---------------------------------------------------
    //
    // Two parallel fee paths, distinguished by who pays:
    //
    //   _sendUserMessage / _sendUserTokensAndMessage
    //     User-initiated sends (bridgeOTokenToPeer). msg.value MUST cover the fee.
    //     No fallback to the strategy's pool. Rationale: an attacker could otherwise drain
    //     the operator-funded pool by spamming bridge_in/out with msg.value=0. User pays
    //     for their own bridge tx.
    //
    //   _sendOpMessage / _sendOpTokensAndMessage
    //     Operator/protocol-funded sends (yield channel deposits/withdraws/claims and the
    //     acks Remote sends in response to inbound). msg.value (if any) lands in
    //     `address(this).balance` first via `receive()`; we then check `balance >= fee`,
    //     which covers both pre-funded pool AND any msg.value attached.
    //
    // Excess msg.value is NEVER refunded. Overpayment becomes part of the strategy's pool.
    // Recovery via `transferNative` (governor only). Rationale: refunds add code surface;
    // callers can quote exactly via `IBridgeAdapter.quoteFee` to avoid leaks.

    /// @dev Operator-funded yield-channel message send (message-only).
    function _sendYieldMessage(
        uint32 msgType,
        uint64 nonce,
        bytes memory body
    ) internal {
        _sendOpMessage(msgType, nonce, body);
    }

    /// @dev Operator-funded yield-channel send carrying tokens (DEPOSIT, WITHDRAW_CLAIM_ACK).
    function _sendYieldTokensAndMessage(
        address token,
        uint256 amount,
        uint32 msgType,
        uint64 nonce,
        bytes memory body
    ) internal {
        _sendOpTokensAndMessage(token, amount, msgType, nonce, body);
    }

    /// @dev User-funded bridge-channel send (BRIDGE_IN / BRIDGE_OUT). msg.value required.
    function _sendBridgeMessage(
        uint32 msgType,
        uint64 nonce,
        bytes memory body
    ) internal {
        _sendUserMessage(msgType, nonce, body);
    }

    /// @dev Strict user-payment path: msg.value MUST cover fee. Pool is NOT consulted —
    ///      even if it has funds, a short user payment reverts. This is the security gate
    ///      that prevents bridge_in/out from being a pool-drain vector.
    function _sendUserMessage(
        uint32 msgType,
        uint64 nonce,
        bytes memory body
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
        ) = IBridgeAdapter(adapter).quoteFee(address(0), 0, payload);
        if (requiresExternalPayment) {
            // Only native fee supported today. ERC20 fee tokens (e.g., LINK-mode CCIP)
            // would need explicit allowance handling; not implemented here. Forces any
            // future fee-token addition to be an explicit override.
            require(feeToken == address(0), "V3: only native fee supported");
            require(msg.value >= fee, "V3: insufficient user fee");
            IBridgeAdapter(adapter).sendMessage{ value: fee }(payload);
        } else {
            // CCTP-style: protocol auto-deducts from bridged amount; no caller action.
            IBridgeAdapter(adapter).sendMessage(payload);
        }
    }

    /// @dev Pool-funded path: native fee paid from `address(this).balance`. msg.value (if
    ///      any) already lands in balance via `receive()`, so this naturally covers both
    ///      pre-funded pool AND inline operator top-ups.
    function _sendOpMessage(
        uint32 msgType,
        uint64 nonce,
        bytes memory body
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
        ) = IBridgeAdapter(adapter).quoteFee(address(0), 0, payload);
        if (requiresExternalPayment) {
            require(feeToken == address(0), "V3: only native fee supported");
            require(address(this).balance >= fee, "V3: pool unfunded");
            IBridgeAdapter(adapter).sendMessage{ value: fee }(payload);
        } else {
            IBridgeAdapter(adapter).sendMessage(payload);
        }
    }

    /// @dev Token-carrying variant of `_sendUserMessage`. Unused for V3 today (bridge
    ///      channel is message-only on the wire), but kept symmetric for future use.
    function _sendUserTokensAndMessage(
        address token,
        uint256 amount,
        uint32 msgType,
        uint64 nonce,
        bytes memory body
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
            require(feeToken == address(0), "V3: only native fee supported");
            require(msg.value >= fee, "V3: insufficient user fee");
            IBridgeAdapter(adapter).sendMessageAndTokens{ value: fee }(
                token,
                amount,
                payload
            );
        } else {
            IBridgeAdapter(adapter).sendMessageAndTokens(
                token,
                amount,
                payload
            );
        }
    }

    /// @dev Token-carrying variant of `_sendOpMessage`. Used by DEPOSIT (Master) and
    ///      WITHDRAW_CLAIM_ACK with tokens (Remote).
    function _sendOpTokensAndMessage(
        address token,
        uint256 amount,
        uint32 msgType,
        uint64 nonce,
        bytes memory body
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
            require(feeToken == address(0), "V3: only native fee supported");
            require(address(this).balance >= fee, "V3: pool unfunded");
            IBridgeAdapter(adapter).sendMessageAndTokens{ value: fee }(
                token,
                amount,
                payload
            );
        } else {
            IBridgeAdapter(adapter).sendMessageAndTokens(
                token,
                amount,
                payload
            );
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

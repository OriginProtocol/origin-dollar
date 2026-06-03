// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Governable } from "../../governance/Governable.sol";
import { IBridgeReceiver } from "../../interfaces/crosschainV3/IBridgeReceiver.sol";
import { IOutboundAdapter } from "../../interfaces/crosschainV3/IOutboundAdapter.sol";

/**
 * @title AbstractCrossChainV3Strategy
 * @author Origin Protocol Inc
 *
 * @notice Shared base for OUSD V3 Master (L2) and Remote (Ethereum) strategies. Provides:
 *           - Bridge-agnostic outbound / inbound adapter wiring
 *           - Yield-channel nonce machinery (one yield op in flight at a time)
 *           - Inbound `receiveFromBridge` entry point with adapter-only access control,
 *             dispatching to a single hook the concrete strategy implements
 *
 *         The concrete Master and Remote contracts also inherit `InitializableAbstractStrategy`
 *         so they pick up vault wiring, governance, and the `nonReentrant` modifier via the
 *         shared `Governable` base.
 *
 *         The abstract does NOT itself inherit `InitializableAbstractStrategy` — it stays
 *         small and focused so it can be composed independently of the platform/vault model
 *         (useful for testing and for adapters that might want to share this nonce machinery).
 */
abstract contract AbstractCrossChainV3Strategy is Governable, IBridgeReceiver {
    // --- Events -------------------------------------------------------------

    event OutboundAdapterUpdated(address oldAdapter, address newAdapter);
    event InboundAdapterUpdated(address oldAdapter, address newAdapter);
    event OperatorUpdated(address oldOperator, address newOperator);
    event YieldNonceAdvanced(uint64 nonce);
    event YieldNonceProcessed(uint64 nonce);

    // --- Storage (all new slots; nothing relocated from any parent) ---------

    /// @notice Adapter used to send outbound messages and tokens to the peer chain.
    address public outboundAdapter;

    /// @notice Adapter authorised to call `receiveFromBridge` on this strategy.
    ///         For atomic bridges the outbound and inbound adapters can be the same address.
    ///         For split-delivery bridges this is the inbound adapter that runs
    ///         store-and-process.
    address public inboundAdapter;

    /// @notice Account allowed to drive periodic, permissioned operations
    ///         (balance check, settlement, claim trigger). Set by governor.
    address public operator;

    /// @notice Highest yield-channel nonce ever assigned.
    uint64 public lastYieldNonce;

    /// @notice Marks each yield-channel nonce as processed (true) once its
    ///         message round-trip completes.
    mapping(uint64 => bool) public nonceProcessed;

    /// @dev Reserved for future expansion of this abstract layer.
    uint256[44] private __gap;

    // --- Modifiers ----------------------------------------------------------

    modifier onlyInboundAdapter() {
        require(
            inboundAdapter != address(0) && msg.sender == inboundAdapter,
            "V3: only inbound adapter"
        );
        _;
    }

    modifier onlyOperatorOrGovernor() {
        require(
            msg.sender == operator || isGovernor(),
            "V3: only operator or governor"
        );
        _;
    }

    // --- Adapter / operator configuration (governor) ------------------------

    function setOutboundAdapter(address _outboundAdapter)
        external
        onlyGovernor
    {
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
     *      configured receiver adapter, then forwards to the concrete strategy's hook.
     *      No `nonReentrant` here — the concrete strategy's hook is the right place to
     *      apply it (and to make the optional post-delivery call only after state has been
     *      finalised).
     */
    function receiveFromBridge(
        uint64 nonce,
        uint256 amount,
        uint8 messageType,
        bytes calldata payload
    ) external override onlyInboundAdapter {
        _handleBridgeMessage(nonce, amount, messageType, payload);
    }

    /**
     * @dev Concrete strategies (Master / Remote) override this to dispatch by `messageType`
     *      and implement the per-message logic.
     */
    function _handleBridgeMessage(
        uint64 nonce,
        uint256 amount,
        uint8 messageType,
        bytes calldata payload
    ) internal virtual;

    // --- Outbound convenience wrappers --------------------------------------

    function _sendMessage(bytes memory message) internal {
        IOutboundAdapter(outboundAdapter).sendMessage{ value: msg.value }(
            message
        );
    }

    function _sendTokensAndMessage(
        address token,
        uint256 amount,
        bytes memory message
    ) internal {
        IOutboundAdapter(outboundAdapter).sendTokensAndMessage{
            value: msg.value
        }(token, amount, message);
    }
}

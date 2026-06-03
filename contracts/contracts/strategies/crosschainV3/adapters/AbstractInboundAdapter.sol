// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { Governable } from "../../../governance/Governable.sol";
import { IBridgeReceiver } from "../../../interfaces/crosschainV3/IBridgeReceiver.sol";

/**
 * @title AbstractInboundAdapter
 * @author Origin Protocol Inc
 *
 * @notice Routing base for OUSD V3 inbound bridge adapters. Multi-tenant: a single deployment
 *         routes inbound messages to any number of strategies via a per-peer mapping
 *         `strategyFor[sourceChainSelector][peerOutbound] = strategy`.
 *
 *         This base handles the concern shared by every inbound adapter — routing — and
 *         nothing else. Split-delivery adapters (where the message and tokens arrive in
 *         separate transactions) extend `AbstractSplitInboundAdapter` to add the pending-slot
 *         lifecycle. Atomic adapters (CCIP, CCTP) extend this base directly.
 */
abstract contract AbstractInboundAdapter is Governable {
    using SafeERC20 for IERC20;

    /// @notice Per-peer routing: (sourceChainSelector, peerOutbound) → strategy.
    mapping(uint64 => mapping(address => address)) public strategyFor;

    event PeerRegistered(
        uint64 indexed chainSelector,
        address indexed peerOutbound,
        address indexed strategy
    );
    event PeerUnregistered(
        uint64 indexed chainSelector,
        address indexed peerOutbound
    );
    event MessageDelivered(
        address indexed strategy,
        uint64 nonce,
        uint8 messageType
    );

    constructor() {
        // Bootstrap the deployer as initial governor; transfer to a Timelock /
        // multisig as part of the deploy flow.
        _setGovernor(msg.sender);
    }

    /**
     * @notice Register a (sourceChainSelector, peerOutbound) → strategy route. Inbound messages
     *         from this peer will be delivered to `_strategy`.
     */
    function registerPeer(
        uint64 _chainSelector,
        address _peerOutbound,
        address _strategy
    ) external onlyGovernor {
        require(_peerOutbound != address(0), "Adapter: zero peer");
        require(_strategy != address(0), "Adapter: zero strategy");
        strategyFor[_chainSelector][_peerOutbound] = _strategy;
        emit PeerRegistered(_chainSelector, _peerOutbound, _strategy);
    }

    /**
     * @notice Tear down a previously-registered peer route. Existing pending slots (if any,
     *         on split-delivery adapters) for the affected strategy are unaffected; finalise
     *         or sweep them separately if needed.
     */
    function unregisterPeer(uint64 _chainSelector, address _peerOutbound)
        external
        onlyGovernor
    {
        delete strategyFor[_chainSelector][_peerOutbound];
        emit PeerUnregistered(_chainSelector, _peerOutbound);
    }

    /**
     * @dev Forward a fully-formed inbound delivery to the strategy. Atomic adapters call this
     *      directly after their bridge transport has placed tokens on this adapter. Split
     *      adapters call it from `processStoredMessage` once the token leg has landed.
     */
    function _deliverAtomic(
        address strategy,
        uint64 nonce,
        uint256 amount,
        uint8 messageType,
        bytes memory payload,
        address token
    ) internal {
        if (amount > 0 && token != address(0)) {
            IERC20(token).safeTransfer(strategy, amount);
        }
        IBridgeReceiver(strategy).receiveFromBridge(
            nonce,
            amount,
            messageType,
            payload
        );
        emit MessageDelivered(strategy, nonce, messageType);
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { Governable } from "../../../governance/Governable.sol";
import { IBridgeReceiver } from "../../../interfaces/crosschainV3/IBridgeReceiver.sol";
import { IReceiverAdapter } from "../../../interfaces/crosschainV3/IReceiverAdapter.sol";
import { CrossChainV3Helper } from "../CrossChainV3Helper.sol";

/**
 * @title AbstractReceiverAdapter
 * @author Origin Protocol Inc
 *
 * @notice Shared base for OUSD V3 inbound bridge adapters. Stores the configured strategy
 *         (the IBridgeReceiver this adapter feeds) and the peer adapter on the source chain
 *         (authorised sender of bridge messages destined for our strategy).
 *
 *         Includes a single-slot pending-message holder used by split-delivery adapters
 *         (canonical bridges). Atomic adapters never use the pending slot.
 */
abstract contract AbstractReceiverAdapter is IReceiverAdapter, Governable {
    using SafeERC20 for IERC20;

    /// @notice The strategy this adapter delivers inbound messages to.
    address public strategy;

    /// @notice Peer outbound adapter on the source chain. Inbound messages must originate from
    ///         this address (or the bridge attests it does) to be accepted.
    address public peerOutbound;

    /// @notice Source chain selector for the peer.
    uint64 public peerChainSelector;

    /// @notice Pending message slot for split-delivery flows. Atomic adapters leave this empty.
    struct PendingMessage {
        bool exists;
        uint64 nonce;
        uint256 expectedAmount;
        uint8 messageType;
        bytes payload;
        address token;
    }
    PendingMessage internal pending;

    event StrategyConfigured(address strategy);
    event PeerConfigured(address peerOutbound, uint64 peerChainSelector);

    constructor() {
        // Bootstrap the deployer as initial governor; transfer to a Timelock /
        // multisig as part of the deploy flow.
        _setGovernor(msg.sender);
    }

    event MessageStored(
        uint64 nonce,
        uint8 messageType,
        uint256 expectedAmount
    );
    event MessageDelivered(uint64 nonce, uint8 messageType);
    event AdaptedPendingMessageFromOldAdapter(address oldAdapter);

    function setStrategy(address _strategy) external onlyGovernor {
        require(_strategy != address(0), "Adapter: zero strategy");
        strategy = _strategy;
        emit StrategyConfigured(_strategy);
    }

    function setPeer(address _peerOutbound, uint64 _peerChainSelector)
        external
        onlyGovernor
    {
        require(_peerOutbound != address(0), "Adapter: zero peer");
        peerOutbound = _peerOutbound;
        peerChainSelector = _peerChainSelector;
        emit PeerConfigured(_peerOutbound, _peerChainSelector);
    }

    /// @inheritdoc IReceiverAdapter
    function hasPendingMessage() external view returns (bool) {
        return pending.exists;
    }

    /**
     * @notice Adopt a pending message from a previous (now-decommissioned) adapter during a
     *         governance-driven adapter swap. The old adapter must `approve` this contract for
     *         the token amount it holds; we pull the tokens and copy the pending slot.
     */
    function adoptPendingMessage(
        address _oldAdapter,
        PendingMessage calldata _pending
    ) external onlyGovernor {
        require(!pending.exists, "Adapter: already pending");
        if (_pending.token != address(0) && _pending.expectedAmount > 0) {
            IERC20(_pending.token).safeTransferFrom(
                _oldAdapter,
                address(this),
                _pending.expectedAmount
            );
        }
        pending = _pending;
        pending.exists = true;
        emit MessageStored(
            _pending.nonce,
            _pending.messageType,
            _pending.expectedAmount
        );
        emit AdaptedPendingMessageFromOldAdapter(_oldAdapter);
    }

    /**
     * @dev Forward a fully-formed inbound delivery to the strategy. Atomic adapters call this
     *      directly after their bridge transport has placed tokens on this adapter.
     */
    function _deliverAtomic(
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
        emit MessageDelivered(nonce, messageType);
    }

    /**
     * @dev Store the inbound message until its companion token leg arrives.
     */
    function _storePending(
        uint64 nonce,
        uint256 expectedAmount,
        uint8 messageType,
        bytes memory payload,
        address token
    ) internal {
        require(!pending.exists, "Adapter: slot busy");
        pending = PendingMessage({
            exists: true,
            nonce: nonce,
            expectedAmount: expectedAmount,
            messageType: messageType,
            payload: payload,
            token: token
        });
        emit MessageStored(nonce, messageType, expectedAmount);
    }

    /// @inheritdoc IReceiverAdapter
    function processStoredMessage() external virtual override {
        require(pending.exists, "Adapter: nothing pending");
        if (pending.expectedAmount > 0 && pending.token != address(0)) {
            require(
                IERC20(pending.token).balanceOf(address(this)) >=
                    pending.expectedAmount,
                "Adapter: tokens not yet landed"
            );
        }
        PendingMessage memory p = pending;
        delete pending;
        _deliverAtomic(
            p.nonce,
            p.expectedAmount,
            p.messageType,
            p.payload,
            p.token
        );
    }
}

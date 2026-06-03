// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ISplitInboundAdapter } from "../../../interfaces/crosschainV3/ISplitInboundAdapter.sol";
import { AbstractInboundAdapter } from "./AbstractInboundAdapter.sol";

/**
 * @title AbstractSplitInboundAdapter
 * @author Origin Protocol Inc
 *
 * @notice Base for split-delivery inbound bridge adapters — those where the message and its
 *         companion token leg arrive in separate transactions. Extends `AbstractInboundAdapter`
 *         with a per-strategy pending-slot lifecycle so off-chain automation can finalise
 *         delivery once both legs have landed.
 *
 *         Atomic adapters (CCIP, CCTP) do NOT use this base — they deliver in a single
 *         transaction and inherit `AbstractInboundAdapter` directly.
 */
abstract contract AbstractSplitInboundAdapter is
    AbstractInboundAdapter,
    ISplitInboundAdapter
{
    using SafeERC20 for IERC20;

    struct PendingMessage {
        bool exists;
        uint64 nonce;
        uint256 expectedAmount;
        uint8 messageType;
        bytes payload;
        address token;
        address strategy;
    }

    /// @notice Per-strategy pending split-delivery slot.
    mapping(address => PendingMessage) internal pendingFor;

    event MessageStored(
        address indexed strategy,
        uint64 nonce,
        uint8 messageType,
        uint256 expectedAmount
    );
    event AdaptedPendingMessageFromOldAdapter(
        address indexed oldAdapter,
        address indexed strategy
    );

    /// @inheritdoc ISplitInboundAdapter
    function hasPendingMessage(address _strategy) external view returns (bool) {
        return pendingFor[_strategy].exists;
    }

    /**
     * @notice Adopt a pending message from a previous (now-decommissioned) adapter during a
     *         governance-driven adapter swap. The old adapter must `approve` this contract for
     *         the token amount it holds; we pull the tokens and copy the pending slot under
     *         the right strategy.
     */
    function adoptPendingMessage(
        address _oldAdapter,
        PendingMessage calldata _pending
    ) external onlyGovernor {
        require(_pending.strategy != address(0), "Adapter: zero strategy");
        require(
            !pendingFor[_pending.strategy].exists,
            "Adapter: already pending"
        );
        if (_pending.token != address(0) && _pending.expectedAmount > 0) {
            IERC20(_pending.token).safeTransferFrom(
                _oldAdapter,
                address(this),
                _pending.expectedAmount
            );
        }
        pendingFor[_pending.strategy] = _pending;
        pendingFor[_pending.strategy].exists = true;
        emit MessageStored(
            _pending.strategy,
            _pending.nonce,
            _pending.messageType,
            _pending.expectedAmount
        );
        emit AdaptedPendingMessageFromOldAdapter(
            _oldAdapter,
            _pending.strategy
        );
    }

    /**
     * @dev Store the inbound message in the strategy's slot until its companion token leg
     *      arrives.
     */
    function _storePending(
        address strategy,
        uint64 nonce,
        uint256 expectedAmount,
        uint8 messageType,
        bytes memory payload,
        address token
    ) internal {
        require(!pendingFor[strategy].exists, "Adapter: slot busy");
        pendingFor[strategy] = PendingMessage({
            exists: true,
            nonce: nonce,
            expectedAmount: expectedAmount,
            messageType: messageType,
            payload: payload,
            token: token,
            strategy: strategy
        });
        emit MessageStored(strategy, nonce, messageType, expectedAmount);
    }

    /// @inheritdoc ISplitInboundAdapter
    function processStoredMessage(address _strategy) external virtual override {
        PendingMessage memory p = pendingFor[_strategy];
        require(p.exists, "Adapter: nothing pending");
        if (p.expectedAmount > 0 && p.token != address(0)) {
            require(
                IERC20(p.token).balanceOf(address(this)) >= p.expectedAmount,
                "Adapter: tokens not yet landed"
            );
        }
        delete pendingFor[_strategy];
        _deliverAtomic(
            p.strategy,
            p.nonce,
            p.expectedAmount,
            p.messageType,
            p.payload,
            p.token
        );
    }
}

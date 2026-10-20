// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

/// @title MockAsyncWithdrawalVault
/// @notice Mirrors the VaultCore async withdrawal queue: same struct shapes for
///         `withdrawalQueueMetadata()` and `withdrawalRequests()`, 1:1 OToken burn on request,
///         and claims gated on the delay, the requester and queue liquidity. Liquidity is added
///         from the vault's asset balance as in `VaultCore._addWithdrawalQueueLiquidity`, so tests
///         control it by funding the vault with the asset.
contract MockAsyncWithdrawalVault {
    struct WithdrawalQueueMetadata {
        uint128 queued;
        uint128 claimable;
        uint128 claimed;
        uint128 nextWithdrawalIndex;
    }

    struct WithdrawalRequest {
        address withdrawer;
        bool claimed;
        uint40 timestamp;
        uint128 amount;
        uint128 queued;
    }

    address public immutable asset;
    address public immutable oToken;
    uint256 public withdrawalClaimDelay = 600;

    WithdrawalQueueMetadata internal _queue;
    mapping(uint256 => WithdrawalRequest) internal _requests;

    constructor(address _asset, address _oToken) {
        asset = _asset;
        oToken = _oToken;
    }

    function withdrawalQueueMetadata() external view returns (WithdrawalQueueMetadata memory) {
        return _queue;
    }

    function withdrawalRequests(uint256 requestId) external view returns (WithdrawalRequest memory) {
        return _requests[requestId];
    }

    function requestWithdrawal(uint256 _amount) external returns (uint256 requestId, uint256 queued) {
        require(_amount > 0, "Amount must be greater than 0");

        requestId = _queue.nextWithdrawalIndex;
        queued = _queue.queued + _amount;
        _queue.nextWithdrawalIndex = uint128(requestId + 1);
        _queue.queued = uint128(queued);
        _requests[requestId] = WithdrawalRequest({
            withdrawer: msg.sender,
            claimed: false,
            timestamp: uint40(block.timestamp),
            amount: uint128(_amount),
            queued: uint128(queued)
        });

        MockERC20(oToken).burn(msg.sender, _amount);
    }

    function claimWithdrawal(uint256 _requestId) external returns (uint256 amount) {
        _addWithdrawalQueueLiquidity();

        WithdrawalRequest memory request = _requests[_requestId];
        require(request.timestamp + withdrawalClaimDelay <= block.timestamp, "Claim delay not met");
        require(request.queued <= _queue.claimable, "Queue pending liquidity");
        require(request.withdrawer == msg.sender, "Not requester");
        require(request.claimed == false, "Already claimed");

        _requests[_requestId].claimed = true;
        _queue.claimed += request.amount;
        amount = request.amount;

        MockERC20(asset).transfer(msg.sender, amount);
    }

    function _addWithdrawalQueueLiquidity() internal {
        uint256 shortfall = _queue.queued - _queue.claimable;
        if (shortfall == 0) return;
        uint256 balance = MockERC20(asset).balanceOf(address(this));
        uint256 allocated = _queue.claimable - _queue.claimed;
        if (balance <= allocated) return;
        uint256 unallocated = balance - allocated;
        _queue.claimable += uint128(shortfall < unallocated ? shortfall : unallocated);
    }
}

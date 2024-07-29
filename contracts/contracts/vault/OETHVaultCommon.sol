// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { VaultStorage } from "./VaultStorage.sol";

/**
 * @title OETHVaultCommon
 * @author Origin Protocol Inc
 */
contract OETHVaultCommon is VaultStorage {
    address public immutable weth;

    constructor(address _weth) {
        weth = _weth;
    }

    /// @dev Adds WETH to the withdrawal queue if there is a funding shortfall.
    /// This assumes 1 WETH equal 1 OETH.
    function _addWithdrawalQueueLiquidity()
        internal
        returns (uint256 addedClaimable)
    {
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // Check if the claimable WETH is less than the queued amount
        uint256 queueShortfall = queue.queued - queue.claimable;

        // No need to do anything is the withdrawal queue is full funded
        if (queueShortfall == 0) {
            return 0;
        }

        uint256 wethBalance = IERC20(weth).balanceOf(address(this));

        // Of the claimable withdrawal requests, how much is unclaimed?
        // That is, the amount of WETH that is currently allocated for the withdrawal queue
        uint256 allocatedWeth = queue.claimable - queue.claimed;

        // If there is no unallocated WETH then there is nothing to add to the queue
        if (wethBalance <= allocatedWeth) {
            return 0;
        }

        uint256 unallocatedWeth = wethBalance - allocatedWeth;

        // the new claimable amount is the smaller of the queue shortfall or unallocated weth
        addedClaimable = queueShortfall < unallocatedWeth
            ? queueShortfall
            : unallocatedWeth;
        uint256 newClaimable = queue.claimable + addedClaimable;

        // Store the new claimable amount back to storage
        withdrawalQueueMetadata.claimable = uint128(newClaimable);

        // emit a WithdrawalClaimable event
        emit WithdrawalClaimable(newClaimable, addedClaimable);
    }

    /***************************************
                View Functions
    ****************************************/

    /// @dev Calculate how much WETH in the vault is not reserved for the withdrawal queue.
    // That is, it is available to be redeemed or deposited into a strategy.
    function _wethAvailable() internal view returns (uint256 wethAvailable) {
        WithdrawalQueueMetadata memory queue = withdrawalQueueMetadata;

        // The amount of WETH that is still to be claimed in the withdrawal queue
        uint256 outstandingWithdrawals = queue.queued - queue.claimed;

        // The amount of sitting in WETH in the vault
        uint256 wethBalance = IERC20(weth).balanceOf(address(this));

        // If there is more WETH in the vault than the outstanding withdrawals
        if (wethBalance > outstandingWithdrawals) {
            wethAvailable = wethBalance - outstandingWithdrawals;
        }
    }
}

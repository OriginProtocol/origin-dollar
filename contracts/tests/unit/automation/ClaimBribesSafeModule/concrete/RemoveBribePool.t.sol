// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_ClaimBribesSafeModule_Shared_Test} from
    "tests/unit/automation/ClaimBribesSafeModule/shared/Shared.t.sol";

import {ClaimBribesSafeModule} from "contracts/automation/ClaimBribesSafeModule.sol";

contract Unit_Concrete_ClaimBribesSafeModule_RemoveBribePool_Test is Unit_ClaimBribesSafeModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- REMOVE BRIBE POOL
    //////////////////////////////////////////////////////

    function test_removeBribePool_removesPool() public {
        // Add a pool first
        address[] memory rewards = new address[](1);
        rewards[0] = makeAddr("RewardToken");
        mockRewardContract.setRewards(rewards);
        _addBribePoolAsVoting(address(mockRewardContract));

        assertTrue(claimBribesModule.bribePoolExists(address(mockRewardContract)));

        vm.prank(address(mockSafe));
        claimBribesModule.removeBribePool(address(mockRewardContract));

        assertFalse(claimBribesModule.bribePoolExists(address(mockRewardContract)));
        assertEq(claimBribesModule.getBribePoolsLength(), 0);
    }

    function test_removeBribePool_noopWhenNotExists() public {
        // Should not revert
        vm.prank(address(mockSafe));
        claimBribesModule.removeBribePool(makeAddr("NonExistent"));
    }

    function test_removeBribePool_emitsBribePoolRemoved() public {
        address[] memory rewards = new address[](1);
        rewards[0] = makeAddr("RewardToken");
        mockRewardContract.setRewards(rewards);
        _addBribePoolAsVoting(address(mockRewardContract));

        vm.prank(address(mockSafe));
        vm.expectEmit(true, true, true, true);
        emit ClaimBribesSafeModule.BribePoolRemoved(address(mockRewardContract));
        claimBribesModule.removeBribePool(address(mockRewardContract));
    }

    function test_removeBribePool_RevertWhen_notSafe() public {
        vm.prank(operator);
        vm.expectRevert("Caller is not the safe contract");
        claimBribesModule.removeBribePool(address(mockRewardContract));
    }
}

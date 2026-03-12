// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_ClaimBribesSafeModule_Shared_Test} from
    "tests/unit/automation/ClaimBribesSafeModule/shared/Shared.t.sol";

import {MockCLRewardContract} from "tests/mocks/MockCLRewardContract.sol";
import {MockCLPoolForBribes, MockCLGaugeForBribes} from "tests/mocks/MockCLPoolForBribes.sol";
import {ClaimBribesSafeModule} from "contracts/automation/ClaimBribesSafeModule.sol";

contract Unit_Concrete_ClaimBribesSafeModule_AddBribePool_Test is Unit_ClaimBribesSafeModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ADD BRIBE POOL
    //////////////////////////////////////////////////////

    function test_addBribePool_addsVotingContract() public {
        // Set up reward tokens on the voting contract (acts as its own reward contract)
        address[] memory rewards = new address[](1);
        rewards[0] = makeAddr("RewardToken");
        mockRewardContract.setRewards(rewards);

        _addBribePoolAsVoting(address(mockRewardContract));

        assertTrue(claimBribesModule.bribePoolExists(address(mockRewardContract)));
        assertEq(claimBribesModule.getBribePoolsLength(), 1);
    }

    function test_addBribePool_addsRegularPool() public {
        // Set up reward tokens on the reward contract
        address[] memory rewards = new address[](1);
        rewards[0] = makeAddr("RewardToken");
        mockRewardContract.setRewards(rewards);

        // mockPool -> mockGauge -> mockRewardContract (set up in Shared setUp)
        vm.prank(address(mockSafe));
        claimBribesModule.addBribePool(address(mockPool), false);

        assertTrue(claimBribesModule.bribePoolExists(address(mockPool)));
        assertEq(claimBribesModule.getBribePoolsLength(), 1);
    }

    function test_addBribePool_updatesExistingPool() public {
        // Add pool first
        address[] memory rewards = new address[](1);
        rewards[0] = makeAddr("RewardTokenA");
        mockRewardContract.setRewards(rewards);
        _addBribePoolAsVoting(address(mockRewardContract));

        assertEq(claimBribesModule.getBribePoolsLength(), 1);

        // Update with new reward tokens
        address[] memory newRewards = new address[](2);
        newRewards[0] = makeAddr("RewardTokenB");
        newRewards[1] = makeAddr("RewardTokenC");
        mockRewardContract.setRewards(newRewards);
        _addBribePoolAsVoting(address(mockRewardContract));

        // Should still be 1 pool, not 2
        assertEq(claimBribesModule.getBribePoolsLength(), 1);
    }

    function test_addBribePool_emitsBribePoolAdded() public {
        address[] memory rewards = new address[](1);
        rewards[0] = makeAddr("RewardToken");
        mockRewardContract.setRewards(rewards);

        vm.prank(address(mockSafe));
        vm.expectEmit(true, true, true, true);
        emit ClaimBribesSafeModule.BribePoolAdded(address(mockRewardContract));
        claimBribesModule.addBribePool(address(mockRewardContract), true);
    }

    function test_addBribePool_RevertWhen_notSafe() public {
        vm.prank(operator);
        vm.expectRevert("Caller is not the safe contract");
        claimBribesModule.addBribePool(address(mockRewardContract), true);
    }
}

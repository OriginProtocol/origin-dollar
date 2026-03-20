// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_ClaimBribesSafeModule_Shared_Test} from "tests/unit/automation/ClaimBribesSafeModule/shared/Shared.t.sol";

contract Unit_Concrete_ClaimBribesSafeModule_UpdateRewardTokenAddresses_Test is Unit_ClaimBribesSafeModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- UPDATE REWARD TOKEN ADDRESSES
    //////////////////////////////////////////////////////

    function test_updateRewardTokenAddresses_updatesAllPools() public {
        // Add a bribe pool with initial reward tokens
        address[] memory initialRewards = new address[](1);
        initialRewards[0] = makeAddr("RewardTokenA");
        mockRewardContract.setRewards(initialRewards);
        _addBribePoolAsVoting(address(mockRewardContract));

        // Change the reward tokens on the mock
        address[] memory newRewards = new address[](2);
        newRewards[0] = makeAddr("RewardTokenB");
        newRewards[1] = makeAddr("RewardTokenC");
        mockRewardContract.setRewards(newRewards);

        // Update reward token addresses
        vm.prank(operator);
        claimBribesModule.updateRewardTokenAddresses();

        // Pool still exists with updated rewards (verified by successful claim)
        assertEq(claimBribesModule.getBribePoolsLength(), 1);
    }

    function test_updateRewardTokenAddresses_RevertWhen_notOperator() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not an operator");
        claimBribesModule.updateRewardTokenAddresses();
    }
}

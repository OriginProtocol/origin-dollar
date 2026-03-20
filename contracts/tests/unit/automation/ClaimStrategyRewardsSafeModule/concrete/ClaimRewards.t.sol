// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_ClaimStrategyRewardsSafeModule_Shared_Test} from
    "tests/unit/automation/ClaimStrategyRewardsSafeModule/shared/Shared.t.sol";

import {ClaimStrategyRewardsSafeModule} from "contracts/automation/ClaimStrategyRewardsSafeModule.sol";

contract Unit_Concrete_ClaimStrategyRewardsSafeModule_ClaimRewards_Test
    is Unit_ClaimStrategyRewardsSafeModule_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- CLAIM REWARDS
    //////////////////////////////////////////////////////

    function test_claimRewards_callsCollectRewardTokensOnAllStrategies() public {
        vm.prank(operator);
        claimStrategyRewardsModule.claimRewards(false);
    }

    function test_claimRewards_succeedsWithSilentTrue() public {
        vm.prank(operator);
        claimStrategyRewardsModule.claimRewards(true);
    }

    function test_claimRewards_silentModeDoesNotRevertOnFailure() public {
        mockSafe.setShouldFail(true);

        vm.prank(operator);
        claimStrategyRewardsModule.claimRewards(true);
    }

    function test_claimRewards_RevertWhen_nonSilentAndFailure() public {
        mockSafe.setShouldFail(true);

        vm.prank(operator);
        vm.expectRevert("Failed to claim rewards");
        claimStrategyRewardsModule.claimRewards(false);
    }

    function test_claimRewards_emitsClaimRewardsFailedOnFailure() public {
        mockSafe.setShouldFail(true);

        vm.prank(operator);
        vm.expectEmit(true, true, true, true);
        emit ClaimStrategyRewardsSafeModule.ClaimRewardsFailed(strategyA);
        claimStrategyRewardsModule.claimRewards(true);
    }

    function test_claimRewards_RevertWhen_notOperator() public {
        vm.prank(josh);
        vm.expectRevert();
        claimStrategyRewardsModule.claimRewards(false);
    }
}

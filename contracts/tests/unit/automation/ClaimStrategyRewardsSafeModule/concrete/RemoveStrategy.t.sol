// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_ClaimStrategyRewardsSafeModule_Shared_Test
} from "tests/unit/automation/ClaimStrategyRewardsSafeModule/shared/Shared.t.sol";

// --- Project imports
import {IClaimStrategyRewardsSafeModule} from "contracts/interfaces/automation/IClaimStrategyRewardsSafeModule.sol";

contract Unit_Concrete_ClaimStrategyRewardsSafeModule_RemoveStrategy_Test is
    Unit_ClaimStrategyRewardsSafeModule_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- REMOVE STRATEGY
    //////////////////////////////////////////////////////

    function test_removeStrategy_removesAndUnwhitelistsStrategy() public {
        vm.prank(address(mockSafe));
        vm.expectEmit(true, true, true, true);
        emit IClaimStrategyRewardsSafeModule.StrategyRemoved(strategyA);
        claimStrategyRewardsModule.removeStrategy(strategyA);

        assertFalse(claimStrategyRewardsModule.isStrategyWhitelisted(strategyA));
    }

    function test_removeStrategy_RevertWhen_notWhitelisted() public {
        address unknownStrategy = makeAddr("UnknownStrategy");

        vm.prank(address(mockSafe));
        vm.expectRevert("Strategy not whitelisted");
        claimStrategyRewardsModule.removeStrategy(unknownStrategy);
    }

    function test_removeStrategy_RevertWhen_notAdmin() public {
        vm.prank(josh);
        vm.expectRevert();
        claimStrategyRewardsModule.removeStrategy(strategyA);
    }
}

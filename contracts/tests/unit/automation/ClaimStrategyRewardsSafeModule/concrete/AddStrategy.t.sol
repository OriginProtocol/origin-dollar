// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_ClaimStrategyRewardsSafeModule_Shared_Test
} from "tests/unit/automation/ClaimStrategyRewardsSafeModule/shared/Shared.t.sol";

// --- Project imports
import {IClaimStrategyRewardsSafeModule} from "contracts/interfaces/automation/IClaimStrategyRewardsSafeModule.sol";

contract Unit_Concrete_ClaimStrategyRewardsSafeModule_AddStrategy_Test is
    Unit_ClaimStrategyRewardsSafeModule_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- ADD STRATEGY
    //////////////////////////////////////////////////////

    function test_addStrategy_addsAndWhitelistsStrategy() public {
        address newStrategy = makeAddr("NewStrategy");

        vm.prank(address(mockSafe));
        vm.expectEmit(true, true, true, true);
        emit IClaimStrategyRewardsSafeModule.StrategyAdded(newStrategy);
        claimStrategyRewardsModule.addStrategy(newStrategy);

        assertTrue(claimStrategyRewardsModule.isStrategyWhitelisted(newStrategy));
    }

    function test_addStrategy_RevertWhen_alreadyWhitelisted() public {
        vm.prank(address(mockSafe));
        vm.expectRevert("Strategy already whitelisted");
        claimStrategyRewardsModule.addStrategy(strategyA);
    }

    function test_addStrategy_RevertWhen_notAdmin() public {
        address newStrategy = makeAddr("NewStrategy");

        vm.prank(josh);
        vm.expectRevert();
        claimStrategyRewardsModule.addStrategy(newStrategy);
    }
}

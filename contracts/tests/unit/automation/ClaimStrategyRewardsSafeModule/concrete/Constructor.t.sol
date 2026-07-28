// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_ClaimStrategyRewardsSafeModule_Shared_Test
} from "tests/unit/automation/ClaimStrategyRewardsSafeModule/shared/Shared.t.sol";

contract Unit_Concrete_ClaimStrategyRewardsSafeModule_Constructor_Test is
    Unit_ClaimStrategyRewardsSafeModule_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    //////////////////////////////////////////////////////

    function test_constructor_strategyAWhitelisted() public view {
        assertTrue(claimStrategyRewardsModule.isStrategyWhitelisted(strategyA));
    }

    function test_constructor_strategyBWhitelisted() public view {
        assertTrue(claimStrategyRewardsModule.isStrategyWhitelisted(strategyB));
    }

    function test_constructor_operatorRoleGranted() public view {
        assertTrue(claimStrategyRewardsModule.hasRole(claimStrategyRewardsModule.OPERATOR_ROLE(), operator));
    }

    function test_constructor_safeHasAdminRole() public view {
        assertTrue(
            claimStrategyRewardsModule.hasRole(claimStrategyRewardsModule.DEFAULT_ADMIN_ROLE(), address(mockSafe))
        );
    }
}

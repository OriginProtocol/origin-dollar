// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CollectXOGNRewardsModule_Shared_Test} from
    "tests/unit/automation/CollectXOGNRewardsModule/shared/Shared.t.sol";

contract Unit_Concrete_CollectXOGNRewardsModule_Constructor_Test
    is Unit_CollectXOGNRewardsModule_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    //////////////////////////////////////////////////////

    function test_constructor_xognAddress() public view {
        assertEq(address(collectXOGNRewardsModule.xogn()), XOGN_ADDRESS);
    }

    function test_constructor_ognAddress() public view {
        assertEq(address(collectXOGNRewardsModule.ogn()), OGN_ADDRESS);
    }

    function test_constructor_rewardsSourceAddress() public view {
        assertEq(collectXOGNRewardsModule.rewardsSource(), REWARDS_SOURCE);
    }

    function test_constructor_operatorRoleGranted() public view {
        assertTrue(
            collectXOGNRewardsModule.hasRole(collectXOGNRewardsModule.OPERATOR_ROLE(), operator)
        );
    }

    function test_constructor_safeHasAdminRole() public view {
        assertTrue(
            collectXOGNRewardsModule.hasRole(
                collectXOGNRewardsModule.DEFAULT_ADMIN_ROLE(), address(mockSafe)
            )
        );
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BridgedWOETH_Shared_Test} from "tests/unit/token/BridgedWOETH/shared/Shared.t.sol";

contract Unit_Concrete_BridgedWOETH_Initialize_Test is Unit_BridgedWOETH_Shared_Test {
    function test_initialize_setsGovernorAsDefaultAdmin() public view {
        assertEq(bridgedWOETH.governor(), governor);
        assertTrue(bridgedWOETH.hasRole(bridgedWOETH.DEFAULT_ADMIN_ROLE(), governor));
        assertEq(bridgedWOETH.getRoleMemberCount(bridgedWOETH.DEFAULT_ADMIN_ROLE()), 1);
    }

    function test_initialize_RevertWhen_calledTwice() public {
        vm.expectRevert("Initializable: contract is already initialized");
        bridgedWOETH.initialize();
    }
}

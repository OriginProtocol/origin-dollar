// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BridgedWOETH_Shared_Test} from "tests/unit/token/BridgedWOETH/shared/Shared.t.sol";

contract Unit_Concrete_BridgedWOETH_AccessControl_Test is Unit_BridgedWOETH_Shared_Test {
    function test_governorCanGrantAndRevokeRoles() public {
        vm.startPrank(governor);
        bridgedWOETH.grantRole(bridgedWOETH.MINTER_ROLE(), alice);
        bridgedWOETH.grantRole(bridgedWOETH.BURNER_ROLE(), alice);

        assertTrue(bridgedWOETH.hasRole(bridgedWOETH.MINTER_ROLE(), alice));
        assertTrue(bridgedWOETH.hasRole(bridgedWOETH.BURNER_ROLE(), alice));

        bridgedWOETH.revokeRole(bridgedWOETH.MINTER_ROLE(), alice);
        bridgedWOETH.revokeRole(bridgedWOETH.BURNER_ROLE(), alice);
        vm.stopPrank();

        assertFalse(bridgedWOETH.hasRole(bridgedWOETH.MINTER_ROLE(), alice));
        assertFalse(bridgedWOETH.hasRole(bridgedWOETH.BURNER_ROLE(), alice));
    }

    function test_grantRole_RevertWhen_notAdmin() public {
        bytes32 minterRole = bridgedWOETH.MINTER_ROLE();
        vm.prank(alice);
        vm.expectRevert();
        bridgedWOETH.grantRole(minterRole, alice);
    }

    function test_revokeRole_RevertWhen_notAdmin() public {
        bytes32 burnerRole = bridgedWOETH.BURNER_ROLE();
        vm.prank(alice);
        vm.expectRevert();
        bridgedWOETH.revokeRole(burnerRole, burner);
    }
}

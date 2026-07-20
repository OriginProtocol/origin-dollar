// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BridgedWOETH_Shared_Test} from "tests/unit/token/BridgedWOETH/shared/Shared.t.sol";

contract Unit_Concrete_BridgedWOETH_ViewFunctions_Test is Unit_BridgedWOETH_Shared_Test {
    function test_metadata() public view {
        assertEq(bridgedWOETH.name(), "Wrapped OETH");
        assertEq(bridgedWOETH.symbol(), "wOETH");
        assertEq(bridgedWOETH.decimals(), 18);
    }

    function test_roles() public view {
        assertTrue(bridgedWOETH.hasRole(bridgedWOETH.MINTER_ROLE(), minter));
        assertTrue(bridgedWOETH.hasRole(bridgedWOETH.BURNER_ROLE(), burner));
        assertEq(bridgedWOETH.getRoleMember(bridgedWOETH.MINTER_ROLE(), 0), minter);
        assertEq(bridgedWOETH.getRoleMember(bridgedWOETH.BURNER_ROLE(), 0), burner);
    }
}

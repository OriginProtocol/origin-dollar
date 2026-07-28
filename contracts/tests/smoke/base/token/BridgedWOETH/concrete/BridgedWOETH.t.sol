// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_Base_BridgedWOETH_Shared_Test} from "tests/smoke/base/token/BridgedWOETH/shared/Shared.t.sol";
import {Base} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_Base_BridgedWOETH_Test is Smoke_Base_BridgedWOETH_Shared_Test {
    function test_deploymentAndMetadata() public view {
        assertEq(address(bridgedWOETH), Base.BridgedWOETH);
        assertGt(address(bridgedWOETH).code.length, 0);
        assertEq(bridgedWOETH.name(), "Wrapped OETH");
        assertEq(bridgedWOETH.symbol(), "wOETH");
        assertEq(bridgedWOETH.decimals(), 18);
    }

    function test_governorIsDefaultAdmin() public view {
        assertNotEq(bridgedWOETH.governor(), address(0));
        assertTrue(bridgedWOETH.hasRole(bridgedWOETH.DEFAULT_ADMIN_ROLE(), bridgedWOETH.governor()));
    }
}

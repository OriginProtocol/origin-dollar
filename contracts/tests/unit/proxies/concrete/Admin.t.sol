// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Proxies_Shared_Test} from "tests/unit/proxies/shared/Shared.t.sol";
import {InitializeGovernedUpgradeabilityProxy} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";

contract Unit_Concrete_Proxy_Admin_Test is Unit_Proxies_Shared_Test {
    function setUp() public override {
        super.setUp();
        _initializeProxy(proxy, governor);
    }

    // --- admin() ---

    function test_admin_returnsGovernor() public view {
        assertEq(proxy.admin(), governor);
    }

    // --- implementation() ---

    function test_implementation_returnsLogic() public view {
        assertEq(proxy.implementation(), address(impl));
    }

    function test_implementation_beforeInitialize() public {
        // Fresh uninitialized proxy2 we test with deployer as governor
        vm.prank(deployer);
        proxy = new InitializeGovernedUpgradeabilityProxy();
        assertEq(proxy.implementation(), address(0));
    }

    // --- governor() ---

    function test_governor_returnsGovernor() public view {
        assertEq(proxy.governor(), governor);
    }

    // --- isGovernor() ---

    function test_isGovernor_returnsTrueForGovernor() public {
        vm.prank(governor);
        assertTrue(proxy.isGovernor());
    }

    function test_isGovernor_returnsFalseForNonGovernor() public {
        vm.prank(alice);
        assertFalse(proxy.isGovernor());
    }
}

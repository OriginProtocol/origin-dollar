// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Proxies_Shared_Test} from "tests/unit/proxies/shared/Shared.t.sol";
import {MockImplementation} from "tests/mocks/MockImplementation.sol";

contract Unit_Concrete_Proxy_Fallback_Test is Unit_Proxies_Shared_Test {
    function setUp() public override {
        super.setUp();
        _initializeProxy(proxy, governor);
    }

    // --- Delegate success (assembly default branch) ---

    function test_fallback_delegatesSetValue() public {
        MockImplementation(payable(address(proxy))).setValue(123);
        assertEq(MockImplementation(payable(address(proxy))).getValue(), 123);
    }

    function test_fallback_returnsData() public {
        MockImplementation(payable(address(proxy))).setValue(999);
        assertEq(MockImplementation(payable(address(proxy))).getValue(), 999);
    }

    // --- Delegate revert (assembly case 0 branch) ---

    function test_fallback_revertsWhenDelegatecallReverts() public {
        vm.expectRevert("MockImplementation: reverted");
        MockImplementation(payable(address(proxy))).revertingFunction();
    }

    // --- ETH forwarding ---

    function test_fallback_receivesETH() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool success,) = address(proxy).call{value: 1 ether}("");
        assertTrue(success);
        assertEq(address(proxy).balance, 1 ether);
    }

    // --- Multiple calls preserve state ---

    function test_fallback_multipleCallsPreserveState() public {
        MockImplementation(payable(address(proxy))).setValue(10);
        MockImplementation(payable(address(proxy))).setValue(20);
        assertEq(MockImplementation(payable(address(proxy))).getValue(), 20);
    }
}

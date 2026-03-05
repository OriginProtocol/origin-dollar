// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Proxies_Shared_Test} from "tests/unit/proxies/shared/Shared.sol";
import {MockImplementation} from "tests/mocks/MockImplementation.sol";

contract Unit_Concrete_Proxy_Fallback_Test is Unit_Proxies_Shared_Test {
    function setUp() public override {
        super.setUp();
        _initializeProxy(proxy, governor);
    }

    // --- Delegate success (assembly default branch) ---

    function test_fallback_delegatesSetValue() public {
        // Call setValue through proxy
        (bool success, ) = address(proxy).call(
            abi.encodeWithSelector(MockImplementation.setValue.selector, 123)
        );
        assertTrue(success);

        // Read back through proxy
        (bool success2, bytes memory result) = address(proxy).staticcall(
            abi.encodeWithSelector(MockImplementation.getValue.selector)
        );
        assertTrue(success2);
        assertEq(abi.decode(result, (uint256)), 123);
    }

    function test_fallback_returnsData() public {
        // Set a value first
        (bool s1, ) = address(proxy).call(
            abi.encodeWithSelector(MockImplementation.setValue.selector, 999)
        );
        assertTrue(s1);

        // Read it back — tests that return data is forwarded
        (bool s2, bytes memory result) = address(proxy).staticcall(
            abi.encodeWithSelector(MockImplementation.getValue.selector)
        );
        assertTrue(s2);
        assertEq(abi.decode(result, (uint256)), 999);
    }

    // --- Delegate revert (assembly case 0 branch) ---

    function test_fallback_revertsWhenDelegatecallReverts() public {
        (bool success, bytes memory returnData) = address(proxy).call(
            abi.encodeWithSelector(MockImplementation.revertingFunction.selector)
        );
        assertFalse(success);
        // Verify the revert reason is forwarded
        assertGt(returnData.length, 0);
    }

    // --- ETH forwarding ---

    function test_fallback_receivesETH() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool success, ) = address(proxy).call{value: 1 ether}("");
        assertTrue(success);
        assertEq(address(proxy).balance, 1 ether);
    }

    // --- Multiple calls preserve state ---

    function test_fallback_multipleCallsPreserveState() public {
        // Set value to 10
        (bool s1, ) = address(proxy).call(
            abi.encodeWithSelector(MockImplementation.setValue.selector, 10)
        );
        assertTrue(s1);

        // Set value to 20
        (bool s2, ) = address(proxy).call(
            abi.encodeWithSelector(MockImplementation.setValue.selector, 20)
        );
        assertTrue(s2);

        // Read — should be 20
        (bool s3, bytes memory result) = address(proxy).staticcall(
            abi.encodeWithSelector(MockImplementation.getValue.selector)
        );
        assertTrue(s3);
        assertEq(abi.decode(result, (uint256)), 20);
    }
}

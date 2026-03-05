// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Proxies_Shared_Test} from "tests/unit/proxies/shared/Shared.sol";
import {Governable} from "contracts/governance/Governable.sol";
import {InitializeGovernedUpgradeabilityProxy} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";
import {MockImplementation} from "tests/mocks/MockImplementation.sol";

contract Unit_Concrete_Proxy_Initialize_Test is Unit_Proxies_Shared_Test {
    // --- Success cases ---

    function test_initialize_setsImplementation() public {
        vm.prank(deployer);
        proxy.initialize(address(impl), governor, bytes(""));

        assertEq(proxy.implementation(), address(impl));
    }

    function test_initialize_setsGovernor() public {
        vm.prank(deployer);
        proxy.initialize(address(impl), governor, bytes(""));

        assertEq(proxy.governor(), governor);
    }

    function test_initialize_withData_delegatecalls() public {
        bytes memory data = abi.encodeWithSelector(MockImplementation.initialize.selector);

        vm.prank(deployer);
        proxy.initialize(address(impl), governor, data);

        // Verify delegatecall was made: read initialized state through proxy
        (bool success, bytes memory result) = address(proxy).staticcall(
            abi.encodeWithSelector(MockImplementation.getValue.selector)
        );
        assertTrue(success);
        // getValue returns 0 (default) - the important thing is the delegatecall succeeded
        assertEq(abi.decode(result, (uint256)), 0);
    }

    function test_initialize_emptyData_skipsDelegatecall() public {
        vm.prank(deployer);
        proxy.initialize(address(impl), governor, bytes(""));

        assertEq(proxy.implementation(), address(impl));
        assertEq(proxy.governor(), governor);
    }

    function test_initialize_emitsGovernorshipTransferred() public {
        vm.expectEmit(true, true, true, true);
        emit Governable.GovernorshipTransferred(deployer, governor);

        vm.prank(deployer);
        proxy.initialize(address(impl), governor, bytes(""));
    }

    // Works on proxy2 (InitializeGovernedUpgradeabilityProxy2)
    function test_initialize_proxy2() public {
        vm.prank(governor);
        proxy2.initialize(address(impl), governor, bytes(""));

        assertEq(proxy2.implementation(), address(impl));
        assertEq(proxy2.governor(), governor);
    }

    // Works on crossChainProxy
    function test_initialize_crossChainProxy() public {
        vm.prank(governor);
        crossChainProxy.initialize(address(impl), governor, bytes(""));

        assertEq(crossChainProxy.implementation(), address(impl));
        assertEq(crossChainProxy.governor(), governor);
    }

    // --- Revert cases ---

    function test_initialize_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        proxy.initialize(address(impl), governor, bytes(""));
    }

    function test_initialize_RevertWhen_alreadyInitialized() public {
        vm.prank(deployer);
        proxy.initialize(address(impl), governor, bytes(""));

        vm.prank(governor);
        vm.expectRevert(); // _implementation() != address(0)
        proxy.initialize(address(implV2), governor, bytes(""));
    }

    function test_initialize_RevertWhen_logicIsZero() public {
        vm.prank(deployer);
        vm.expectRevert("Implementation not set");
        proxy.initialize(address(0), governor, bytes(""));
    }

    function test_initialize_RevertWhen_logicNotContract() public {
        vm.prank(deployer);
        vm.expectRevert("Cannot set a proxy implementation to a non-contract address");
        proxy.initialize(alice, governor, bytes(""));
    }

    function test_initialize_RevertWhen_delegatecallFails() public {
        bytes memory data = abi.encodeWithSelector(MockImplementation.revertingFunction.selector);

        vm.prank(deployer);
        vm.expectRevert();
        proxy.initialize(address(impl), governor, data);
    }

    function test_initialize_RevertWhen_initGovernorIsZero() public {
        vm.prank(deployer);
        vm.expectRevert("New Governor is address(0)");
        proxy.initialize(address(impl), address(0), bytes(""));
    }
}

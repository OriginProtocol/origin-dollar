// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Proxies_Shared_Test} from "tests/unit/proxies/shared/Shared.sol";
import {InitializeGovernedUpgradeabilityProxy} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";
import {MockImplementation, MockImplementationV2} from "tests/mocks/MockImplementation.sol";

contract Unit_Concrete_Proxy_UpgradeTo_Test is Unit_Proxies_Shared_Test {
    function setUp() public override {
        super.setUp();
        _initializeProxy(proxy, governor);
    }

    // --- Success cases ---

    function test_upgradeTo() public {
        vm.prank(governor);
        proxy.upgradeTo(address(implV2));

        assertEq(proxy.implementation(), address(implV2));
    }

    function test_upgradeTo_emitsUpgraded() public {
        vm.expectEmit(true, true, true, true);
        emit InitializeGovernedUpgradeabilityProxy.Upgraded(address(implV2));

        vm.prank(governor);
        proxy.upgradeTo(address(implV2));
    }

    function test_upgradeTo_preservesState() public {
        // Set value through proxy using V1
        vm.prank(alice);
        (bool success, ) = address(proxy).call(
            abi.encodeWithSelector(MockImplementation.setValue.selector, 42)
        );
        assertTrue(success);

        // Upgrade to V2
        vm.prank(governor);
        proxy.upgradeTo(address(implV2));

        // Read value through proxy using V2 — state preserved
        (bool success2, bytes memory result) = address(proxy).staticcall(
            abi.encodeWithSelector(MockImplementationV2.getValue.selector)
        );
        assertTrue(success2);
        assertEq(abi.decode(result, (uint256)), 42);
    }

    // --- Revert cases ---

    function test_upgradeTo_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        proxy.upgradeTo(address(implV2));
    }

    function test_upgradeTo_RevertWhen_notContract() public {
        vm.prank(governor);
        vm.expectRevert("Cannot set a proxy implementation to a non-contract address");
        proxy.upgradeTo(alice);
    }
}

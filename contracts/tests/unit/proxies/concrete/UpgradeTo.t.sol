// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Proxies_Shared_Test} from "tests/unit/proxies/shared/Shared.t.sol";

// --- Project imports
import {IProxy} from "contracts/interfaces/IProxy.sol";
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
        emit IProxy.Upgraded(address(implV2));

        vm.prank(governor);
        proxy.upgradeTo(address(implV2));
    }

    function test_upgradeTo_preservesState() public {
        vm.prank(alice);
        MockImplementation(payable(address(proxy))).setValue(42);

        vm.prank(governor);
        proxy.upgradeTo(address(implV2));

        assertEq(MockImplementationV2(payable(address(proxy))).getValue(), 42);
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

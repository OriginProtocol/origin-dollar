// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Proxies_Shared_Test} from "tests/unit/proxies/shared/Shared.t.sol";

// --- Project imports
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {MockImplementation, MockImplementationV2} from "tests/mocks/MockImplementation.sol";

contract Unit_Concrete_Proxy_UpgradeToAndCall_Test is Unit_Proxies_Shared_Test {
    function setUp() public override {
        super.setUp();
        _initializeProxy(proxy, governor);
    }

    // --- Success cases ---

    function test_upgradeToAndCall() public {
        bytes memory data = abi.encodeWithSelector(MockImplementationV2.setVersion.selector, 2);

        vm.prank(governor);
        proxy.upgradeToAndCall(address(implV2), data);

        assertEq(proxy.implementation(), address(implV2));

        assertEq(MockImplementationV2(payable(address(proxy))).getVersion(), 2);
    }

    function test_upgradeToAndCall_emitsUpgraded() public {
        bytes memory data = abi.encodeWithSelector(MockImplementationV2.setVersion.selector, 2);

        vm.expectEmit(true, true, true, true);
        emit IProxy.Upgraded(address(implV2));

        vm.prank(governor);
        proxy.upgradeToAndCall(address(implV2), data);
    }

    function test_upgradeToAndCall_payable() public {
        bytes memory data = abi.encodeWithSelector(MockImplementationV2.setVersion.selector, 2);

        vm.deal(governor, 1 ether);
        vm.prank(governor);
        proxy.upgradeToAndCall{value: 1 ether}(address(implV2), data);

        assertEq(address(proxy).balance, 1 ether);
    }

    // --- Revert cases ---

    function test_upgradeToAndCall_RevertWhen_notGovernor() public {
        bytes memory data = abi.encodeWithSelector(MockImplementationV2.setVersion.selector, 2);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        proxy.upgradeToAndCall(address(implV2), data);
    }

    function test_upgradeToAndCall_RevertWhen_notContract() public {
        bytes memory data = abi.encodeWithSelector(MockImplementationV2.setVersion.selector, 2);

        vm.prank(governor);
        vm.expectRevert("Cannot set a proxy implementation to a non-contract address");
        proxy.upgradeToAndCall(alice, data);
    }

    function test_upgradeToAndCall_RevertWhen_delegatecallFails() public {
        bytes memory data = abi.encodeWithSelector(MockImplementation.revertingFunction.selector);

        vm.prank(governor);
        vm.expectRevert();
        proxy.upgradeToAndCall(address(implV2), data);
    }
}

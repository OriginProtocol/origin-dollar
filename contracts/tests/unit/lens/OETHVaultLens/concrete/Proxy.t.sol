// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Lens} from "tests/utils/artifacts/Lens.sol";
import {Unit_OETHVaultLens_Shared_Test} from "../shared/Shared.t.sol";

contract Unit_Concrete_OETHVaultLens_Proxy_Test is Unit_OETHVaultLens_Shared_Test {
    function test_proxy_setsGovernorAndImplementation() public view {
        assertEq(lensProxy.governor(), governor);
        assertEq(lensProxy.admin(), governor);
        assertEq(lensProxy.implementation(), lensImpl);
    }

    function test_upgradeTo_updatesImplementation() public {
        address newImpl = vm.deployCode(Lens.OETH_VAULT_LENS, abi.encode(address(mockVault), address(mockStrategy)));

        vm.prank(governor);
        lensProxy.upgradeTo(newImpl);

        assertEq(lensProxy.implementation(), newImpl);
        assertEq(lens.getRate(), 1e18);
    }

    function test_upgradeTo_RevertWhen_notGovernor() public {
        address newImpl = vm.deployCode(Lens.OETH_VAULT_LENS, abi.encode(address(mockVault), address(mockStrategy)));

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        lensProxy.upgradeTo(newImpl);
    }
}

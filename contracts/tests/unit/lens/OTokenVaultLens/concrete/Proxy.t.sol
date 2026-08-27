// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Lens} from "tests/utils/artifacts/Lens.sol";
import {Unit_OTokenVaultLens_Shared_Test} from "../shared/Shared.t.sol";

contract Unit_Concrete_OTokenVaultLens_Proxy_Test is Unit_OTokenVaultLens_Shared_Test {
    function test_proxy_setsGovernorAndImplementation() public view {
        assertEq(lensProxy.governor(), governor);
        assertEq(lensProxy.admin(), governor);
        assertEq(lensProxy.implementation(), lensImpl);
    }

    function test_upgradeTo_updatesImplementation() public {
        // New implementation without a staking strategy, so the staleness check is gone.
        address newImpl = vm.deployCode(Lens.O_TOKEN_VAULT_LENS, abi.encode(address(mockVault), address(0)));

        vm.prank(governor);
        lensProxy.upgradeTo(newImpl);

        assertEq(lensProxy.implementation(), newImpl);
        mockStrategy.setLastVerifiedBalanceTimestamp(0);
        assertEq(lens.getRate(), 1e18);
    }

    function test_upgradeTo_RevertWhen_notGovernor() public {
        address newImpl = vm.deployCode(Lens.O_TOKEN_VAULT_LENS, abi.encode(address(mockVault), address(0)));

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        lensProxy.upgradeTo(newImpl);
    }
}

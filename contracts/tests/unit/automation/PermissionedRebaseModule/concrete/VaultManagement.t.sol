// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_PermissionedRebaseModule_Shared_Test
} from "tests/unit/automation/PermissionedRebaseModule/shared/Shared.t.sol";

// --- Project imports
import {IPermissionedRebaseModule} from "contracts/interfaces/automation/IPermissionedRebaseModule.sol";

contract Unit_Concrete_PermissionedRebaseModule_VaultManagement_Test is Unit_PermissionedRebaseModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    //////////////////////////////////////////////////////

    function test_constructor_registersInitialVaults() public view {
        assertTrue(permissionedRebaseModule.isVaultWhitelisted(address(oethVault)));
        assertEq(permissionedRebaseModule.vaults(0), address(oethVault));
    }

    //////////////////////////////////////////////////////
    /// --- ADDVAULT
    //////////////////////////////////////////////////////

    function test_addVault() public {
        vm.prank(address(mockSafe));
        permissionedRebaseModule.addVault(alice);

        assertTrue(permissionedRebaseModule.isVaultWhitelisted(alice));
        assertEq(permissionedRebaseModule.vaults(1), alice);
    }

    function test_addVault_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit IPermissionedRebaseModule.VaultAdded(alice);

        vm.prank(address(mockSafe));
        permissionedRebaseModule.addVault(alice);
    }

    function test_addVault_RevertWhen_zeroAddress() public {
        vm.prank(address(mockSafe));
        vm.expectRevert("Vault is zero address");
        permissionedRebaseModule.addVault(address(0));
    }

    function test_addVault_RevertWhen_alreadyWhitelisted() public {
        vm.prank(address(mockSafe));
        vm.expectRevert("Vault already whitelisted");
        permissionedRebaseModule.addVault(address(oethVault));
    }

    function test_addVault_RevertWhen_notAdmin() public {
        vm.prank(operator);
        vm.expectRevert();
        permissionedRebaseModule.addVault(alice);
    }

    //////////////////////////////////////////////////////
    /// --- REMOVEVAULT
    //////////////////////////////////////////////////////

    function test_removeVault() public {
        vm.prank(address(mockSafe));
        permissionedRebaseModule.removeVault(address(oethVault));

        assertFalse(permissionedRebaseModule.isVaultWhitelisted(address(oethVault)));
    }

    function test_removeVault_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit IPermissionedRebaseModule.VaultRemoved(address(oethVault));

        vm.prank(address(mockSafe));
        permissionedRebaseModule.removeVault(address(oethVault));
    }

    /// @dev removeVault swaps the last element into the removed slot, so the
    ///      surviving vault must still be reachable at index 0.
    function test_removeVault_swapsLastIntoGap() public {
        vm.startPrank(address(mockSafe));
        permissionedRebaseModule.addVault(alice);
        permissionedRebaseModule.removeVault(address(oethVault));
        vm.stopPrank();

        assertEq(permissionedRebaseModule.vaults(0), alice);
        assertTrue(permissionedRebaseModule.isVaultWhitelisted(alice));
        assertFalse(permissionedRebaseModule.isVaultWhitelisted(address(oethVault)));
    }

    function test_removeVault_RevertWhen_notWhitelisted() public {
        vm.prank(address(mockSafe));
        vm.expectRevert("Vault not whitelisted");
        permissionedRebaseModule.removeVault(alice);
    }

    function test_removeVault_RevertWhen_notAdmin() public {
        vm.prank(operator);
        vm.expectRevert();
        permissionedRebaseModule.removeVault(address(oethVault));
    }

    /// @dev A removed vault must no longer be driven by permissionedRebase.
    function test_removeVault_stopsRebasing() public {
        vm.prank(address(mockSafe));
        permissionedRebaseModule.removeVault(address(oethVault));

        _injectYield(2e18);
        uint256 supplyBefore = oeth.totalSupply();

        vm.prank(operator);
        permissionedRebaseModule.permissionedRebase();

        assertEq(oeth.totalSupply(), supplyBefore, "Removed vault must not be rebased");
    }
}

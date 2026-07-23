// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_PermissionedRebaseModule_Shared_Test
} from "tests/unit/automation/PermissionedRebaseModule/shared/Shared.t.sol";

// --- Project imports
import {IPermissionedRebaseModule} from "contracts/interfaces/automation/IPermissionedRebaseModule.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";

contract Unit_Concrete_PermissionedRebaseModule_PermissionedRebase_Test is Unit_PermissionedRebaseModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- PERMISSIONEDREBASE
    //////////////////////////////////////////////////////

    function test_permissionedRebase_distributesYield() public {
        _injectYield(2e18);

        uint256 supplyBefore = oeth.totalSupply();

        vm.prank(operator);
        permissionedRebaseModule.permissionedRebase();

        assertGt(oeth.totalSupply(), supplyBefore, "Rebase should have distributed yield");
    }

    /// @dev The whole point of the module: the vault must be left paused again,
    ///      so a partial run can never leave rebasing open.
    function test_permissionedRebase_leavesVaultPaused() public {
        assertTrue(oethVault.rebasePaused(), "Vault should start paused");

        _injectYield(2e18);

        vm.prank(operator);
        permissionedRebaseModule.permissionedRebase();

        assertTrue(oethVault.rebasePaused(), "Vault must be re-paused after the rebase");
    }

    function test_permissionedRebase_emitsEvent() public {
        _injectYield(2e18);

        vm.expectEmit(true, true, true, true);
        emit IPermissionedRebaseModule.PermissionedRebaseExecuted(address(oethVault));

        vm.prank(operator);
        permissionedRebaseModule.permissionedRebase();
    }

    function test_permissionedRebase_withNoYield() public {
        uint256 supplyBefore = oeth.totalSupply();

        vm.prank(operator);
        permissionedRebaseModule.permissionedRebase();

        assertEq(oeth.totalSupply(), supplyBefore, "No yield means no supply change");
        assertTrue(oethVault.rebasePaused(), "Vault must still be re-paused");
    }

    function test_permissionedRebase_withNoVaults() public {
        // Remove the only vault; the loop body should never run.
        vm.prank(address(mockSafe));
        permissionedRebaseModule.removeVault(address(oethVault));

        vm.prank(operator);
        permissionedRebaseModule.permissionedRebase(); // Should not revert
    }

    /// @dev The module loops over every registered vault. Both must be rebased
    ///      and both must be left paused.
    function test_permissionedRebase_acrossMultipleVaults() public {
        (IOToken oeth2, IVault oethVault2) = _deployOethVault();
        _configureVault(oethVault2);
        _fundVault(oethVault2);

        vm.prank(address(mockSafe));
        permissionedRebaseModule.addVault(address(oethVault2));

        _injectYield(oethVault, 2e18);
        _injectYield(oethVault2, 3e18);

        uint256 supply1Before = oeth.totalSupply();
        uint256 supply2Before = oeth2.totalSupply();

        vm.prank(operator);
        permissionedRebaseModule.permissionedRebase();

        assertGt(oeth.totalSupply(), supply1Before, "First vault should have rebased");
        assertGt(oeth2.totalSupply(), supply2Before, "Second vault should have rebased");

        assertTrue(oethVault.rebasePaused(), "First vault must be re-paused");
        assertTrue(oethVault2.rebasePaused(), "Second vault must be re-paused");
    }

    //////////////////////////////////////////////////////
    /// --- AUTHORIZATION
    //////////////////////////////////////////////////////

    function test_permissionedRebase_RevertWhen_notOperator() public {
        vm.prank(alice);
        vm.expectRevert();
        permissionedRebaseModule.permissionedRebase();
    }

    //////////////////////////////////////////////////////
    /// --- ATOMICITY
    //////////////////////////////////////////////////////

    /// @dev If any sub-call fails the whole run must revert, so the vault can
    ///      never be left unpaused by a partial execution.
    function test_permissionedRebase_RevertWhen_safeCallFails() public {
        mockSafe.setShouldFail(true);

        vm.prank(operator);
        vm.expectRevert("Vault call failed");
        permissionedRebaseModule.permissionedRebase();

        assertTrue(oethVault.rebasePaused(), "Vault must remain paused after a failed run");
    }
}

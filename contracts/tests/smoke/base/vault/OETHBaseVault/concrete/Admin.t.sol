// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETHBaseVault_Shared_Test} from "tests/smoke/base/vault/OETHBaseVault/shared/Shared.t.sol";

// --- Test utilities
import {Base as BaseAddresses, CrossChain} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_OETHBaseVault_Admin_Test is Smoke_OETHBaseVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ADMIN ROLE
    //////////////////////////////////////////////////////

    function test_adminAddr_isTheFiveOfEight() public view {
        assertEq(oethBaseVault.adminAddr(), BaseAddresses.admin);
    }

    /// @dev The point of the Admin role: whoever trips a pause cannot immediately lift it.
    function test_strategist_canPauseCapital_butNotUnpause() public {
        vm.prank(strategist);
        oethBaseVault.pauseCapital();
        assertTrue(oethBaseVault.capitalPaused());

        vm.prank(strategist);
        vm.expectRevert("Caller is not the Admin or Governor");
        oethBaseVault.unpauseCapital();
        assertTrue(oethBaseVault.capitalPaused());

        vm.prank(oethBaseVault.adminAddr());
        oethBaseVault.unpauseCapital();
        assertFalse(oethBaseVault.capitalPaused());
    }

    function test_admin_canPauseAndUnpauseRebase() public {
        vm.startPrank(oethBaseVault.adminAddr());

        oethBaseVault.pauseRebase();
        assertTrue(oethBaseVault.rebasePaused());

        oethBaseVault.unpauseRebase();
        assertFalse(oethBaseVault.rebasePaused());

        vm.stopPrank();
    }

    function test_setAdminAddr_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        oethBaseVault.setAdminAddr(alice);
    }

    /// @dev `adminAddr` was carved out of the storage gap, immediately after `defaultStrategy` and
    ///      `operatorAddr`. Those neighbours are where a layout shift would surface first.
    function test_preExistingStorage_survivedTheUpgrade() public view {
        assertTrue(oethBaseVault.defaultStrategy() != address(0));
        assertEq(oethBaseVault.operatorAddr(), CrossChain.talosRelayer);
        assertEq(oethBaseVault.strategistAddr(), CrossChain.multichainStrategist);
        assertEq(oethBaseVault.governor(), BaseAddresses.timelock);
        assertTrue(oethBaseVault.totalValue() > 0);
        assertTrue(oethBase.totalSupply() > 0);
    }
}

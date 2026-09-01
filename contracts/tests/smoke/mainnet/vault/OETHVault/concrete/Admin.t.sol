// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETHVault_Shared_Test} from "tests/smoke/mainnet/vault/OETHVault/shared/Shared.t.sol";

// --- Test utilities
import {CrossChain, Mainnet} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_OETHVault_Admin_Test is Smoke_OETHVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ADMIN ROLE
    //////////////////////////////////////////////////////

    function test_adminAddr_isTheFiveOfEight() public view {
        assertEq(oethVault.adminAddr(), Mainnet.Guardian);
    }

    /// @dev The point of the Admin role: whoever trips a pause cannot immediately lift it.
    function test_strategist_canPauseCapital_butNotUnpause() public {
        vm.prank(strategist);
        oethVault.pauseCapital();
        assertTrue(oethVault.capitalPaused());

        vm.prank(strategist);
        vm.expectRevert("Caller is not the Admin or Governor");
        oethVault.unpauseCapital();
        assertTrue(oethVault.capitalPaused());

        vm.prank(oethVault.adminAddr());
        oethVault.unpauseCapital();
        assertFalse(oethVault.capitalPaused());
    }

    function test_admin_canPauseAndUnpauseRebase() public {
        vm.startPrank(oethVault.adminAddr());

        oethVault.pauseRebase();
        assertTrue(oethVault.rebasePaused());

        oethVault.unpauseRebase();
        assertFalse(oethVault.rebasePaused());

        vm.stopPrank();
    }

    function test_setAdminAddr_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        oethVault.setAdminAddr(alice);
    }

    /// @dev `adminAddr` was carved out of the storage gap, immediately after `defaultStrategy` and
    ///      `operatorAddr`. Those neighbours are where a layout shift would surface first.
    function test_preExistingStorage_survivedTheUpgrade() public view {
        assertTrue(oethVault.defaultStrategy() != address(0));
        assertEq(oethVault.operatorAddr(), CrossChain.talosRelayer);
        assertEq(oethVault.strategistAddr(), CrossChain.multichainStrategist);
        assertEq(oethVault.governor(), Mainnet.Timelock);
        assertTrue(oethVault.totalValue() > 0);
        assertTrue(oeth.totalSupply() > 0);
    }
}

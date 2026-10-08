// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OUSDVault_Shared_Test} from "tests/smoke/mainnet/vault/OUSDVault/shared/Shared.t.sol";

// --- Test utilities
import {CrossChain, Mainnet} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_OUSDVault_Admin_Test is Smoke_OUSDVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ADMIN ROLE
    //////////////////////////////////////////////////////

    function test_adminAddr_isTheFiveOfEight() public view {
        assertEq(ousdVault.adminAddr(), Mainnet.Guardian);
    }

    /// @dev The point of the Admin role: whoever trips a pause cannot immediately lift it.
    function test_strategist_canPauseCapital_butNotUnpause() public {
        vm.prank(strategist);
        ousdVault.pauseCapital();
        assertTrue(ousdVault.capitalPaused());

        vm.prank(strategist);
        vm.expectRevert("Caller is not the Admin or Governor");
        ousdVault.unpauseCapital();
        assertTrue(ousdVault.capitalPaused());

        vm.prank(ousdVault.adminAddr());
        ousdVault.unpauseCapital();
        assertFalse(ousdVault.capitalPaused());
    }

    function test_admin_canPauseAndUnpauseRebase() public {
        vm.startPrank(ousdVault.adminAddr());

        ousdVault.pauseRebase();
        assertTrue(ousdVault.rebasePaused());

        ousdVault.unpauseRebase();
        assertFalse(ousdVault.rebasePaused());

        vm.stopPrank();
    }

    function test_setAdminAddr_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        ousdVault.setAdminAddr(alice);
    }

    /// @dev `adminAddr` was carved out of the storage gap, immediately after `defaultStrategy` and
    ///      `operatorAddr`. Those neighbours are where a layout shift would surface first.
    function test_preExistingStorage_survivedTheUpgrade() public view {
        assertTrue(ousdVault.defaultStrategy() != address(0));
        assertEq(ousdVault.operatorAddr(), CrossChain.talosRelayer);
        assertEq(ousdVault.strategistAddr(), CrossChain.multichainStrategist);
        assertEq(ousdVault.governor(), Mainnet.Timelock);
        assertTrue(ousdVault.totalValue() > 0);
        assertTrue(ousd.totalSupply() > 0);
    }
}

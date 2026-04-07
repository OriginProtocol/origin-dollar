// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OUSD_Shared_Test} from "tests/unit/token/OUSD/shared/Shared.t.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";

contract Unit_Concrete_OUSD_Burn_Test is Unit_OUSD_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- BURN
    //////////////////////////////////////////////////////

    function test_burn_rebasingUser() public {
        uint256 balBefore = ousd.balanceOf(matt);
        uint256 supplyBefore = ousd.totalSupply();

        vm.prank(address(ousdVault));
        ousd.burn(matt, 50e18);

        assertEq(ousd.balanceOf(matt), balBefore - 50e18);
        assertEq(ousd.totalSupply(), supplyBefore - 50e18);
    }

    function test_burn_nonRebasingUser() public {
        // Auto-migrate mockNonRebasing by transferring to it
        vm.prank(matt);
        ousd.transfer(address(mockNonRebasing), 50e18);

        uint256 balBefore = ousd.balanceOf(address(mockNonRebasing));
        uint256 supplyBefore = ousd.totalSupply();

        vm.prank(address(ousdVault));
        ousd.burn(address(mockNonRebasing), 20e18);

        assertEq(ousd.balanceOf(address(mockNonRebasing)), balBefore - 20e18);
        assertEq(ousd.totalSupply(), supplyBefore - 20e18);
    }

    function test_burn_zeroAmount() public {
        uint256 balBefore = ousd.balanceOf(matt);
        uint256 supplyBefore = ousd.totalSupply();

        // burn(amount=0) should return early without changing state
        vm.prank(address(ousdVault));
        ousd.burn(matt, 0);

        assertEq(ousd.balanceOf(matt), balBefore);
        assertEq(ousd.totalSupply(), supplyBefore);
    }

    function test_burn_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit IOToken.Transfer(matt, address(0), 50e18);

        vm.prank(address(ousdVault));
        ousd.burn(matt, 50e18);
    }

    function test_burn_RevertWhen_notVault() public {
        vm.prank(matt);
        vm.expectRevert("Caller is not the Vault");
        ousd.burn(matt, 50e18);
    }

    function test_burn_RevertWhen_zeroAddress() public {
        vm.prank(address(ousdVault));
        vm.expectRevert("Burn from the zero address");
        ousd.burn(address(0), 50e18);
    }

    function test_burn_RevertWhen_insufficientBalance() public {
        vm.prank(address(ousdVault));
        vm.expectRevert("Transfer amount exceeds balance");
        ousd.burn(matt, 101e18);
    }
}

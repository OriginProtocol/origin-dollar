// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_AerodromeAMOStrategy_Shared_Test} from "tests/unit/strategies/AerodromeAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_AerodromeAMOStrategy_DepositAll_Test is Unit_AerodromeAMOStrategy_Shared_Test {
    function test_depositAll() public {
        uint256 amount = 10 ether;
        deal(address(weth), address(aerodromeAMOStrategy), amount);

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.depositAll();

        // Should have deposited all WETH and created position
        assertGt(aerodromeAMOStrategy.tokenId(), 0);
    }

    function test_depositAll_skipsSmallBalance() public {
        // Balance <= 1e12 should be skipped
        deal(address(weth), address(aerodromeAMOStrategy), 1e12);

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.depositAll();

        // No position should be created
        assertEq(aerodromeAMOStrategy.tokenId(), 0);
        // WETH still on contract
        assertEq(weth.balanceOf(address(aerodromeAMOStrategy)), 1e12);
    }

    function test_depositAll_RevertWhen_notVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        aerodromeAMOStrategy.depositAll();
    }

    function test_depositAll_zeroBalance() public {
        // Zero balance should not revert, just skip
        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.depositAll();

        assertEq(aerodromeAMOStrategy.tokenId(), 0);
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_AerodromeAMOStrategy_Shared_Test} from "tests/unit/strategies/AerodromeAMOStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_AerodromeAMOStrategy_Deposit_Test is Unit_AerodromeAMOStrategy_Shared_Test {
    function testFuzz_deposit(uint256 amount) public {
        // Bound to reasonable range: above dust, below reasonable max
        amount = bound(amount, 1e13, 1_000_000 ether);

        deal(address(weth), address(aerodromeAMOStrategy), amount);

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.deposit(address(weth), amount);

        // Should have created a position (pool price is in range)
        assertGt(aerodromeAMOStrategy.tokenId(), 0);
    }

    function testFuzz_deposit_outOfRange(uint256 amount) public {
        amount = bound(amount, 1e13, 1_000_000 ether);

        // Set pool out of range
        _setPoolPriceOutOfRange();

        deal(address(weth), address(aerodromeAMOStrategy), amount);

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.deposit(address(weth), amount);

        // WETH should remain on contract, no position
        assertEq(weth.balanceOf(address(aerodromeAMOStrategy)), amount);
        assertEq(aerodromeAMOStrategy.tokenId(), 0);
    }
}

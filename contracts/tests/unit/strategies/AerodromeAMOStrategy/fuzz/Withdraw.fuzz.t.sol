// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_AerodromeAMOStrategy_Shared_Test} from "tests/unit/strategies/AerodromeAMOStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_AerodromeAMOStrategy_Withdraw_Test is Unit_AerodromeAMOStrategy_Shared_Test {
    function testFuzz_withdraw(uint256 amount) public {
        // Bound to reasonable range
        amount = bound(amount, 1, 100 ether);

        // Deal WETH directly to strategy (no liquidity position needed for simple withdrawal)
        deal(address(weth), address(aerodromeAMOStrategy), amount);

        uint256 vaultBalBefore = weth.balanceOf(address(oethBaseVault));

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), address(weth), amount);

        assertEq(weth.balanceOf(address(oethBaseVault)) - vaultBalBefore, amount);
        assertEq(weth.balanceOf(address(aerodromeAMOStrategy)), 0);
    }
}

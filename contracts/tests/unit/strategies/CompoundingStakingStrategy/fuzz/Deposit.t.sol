// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CompoundingStakingStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_CompoundingStakingStrategy_Deposit_Test is Unit_CompoundingStakingStrategy_Shared_Test {
    /// @dev Fuzz deposit amounts
    function testFuzz_deposit(uint256 amount) public {
        amount = bound(amount, 1, 10_000 ether);

        vm.prank(josh);
        weth.transfer(address(compoundingStakingStrategy), amount);

        vm.prank(address(oethVault));
        compoundingStakingStrategy.deposit(address(mockWeth), amount);

        assertEq(compoundingStakingStrategy.depositedWethAccountedFor(), amount);
    }

    /// @dev Fuzz checkBalance with varying WETH
    function testFuzz_checkBalance(uint256 wethAmount) public {
        wethAmount = bound(wethAmount, 0, 10_000 ether);

        if (wethAmount > 0) {
            vm.prank(josh);
            weth.transfer(address(compoundingStakingStrategy), wethAmount);
        }

        // checkBalance = lastVerifiedEthBalance (0) + WETH balance
        assertEq(compoundingStakingStrategy.checkBalance(address(mockWeth)), wethAmount);
    }
}

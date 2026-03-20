// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CompoundingStakingSSVStrategy_Shared_Test} from
    "tests/unit/strategies/CompoundingStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_CompoundingStakingSSVStrategy_Deposit_Test
    is Unit_CompoundingStakingSSVStrategy_Shared_Test
{
    /// @dev Fuzz deposit amounts
    function testFuzz_deposit(uint256 amount) public {
        amount = bound(amount, 1, 10_000 ether);

        vm.prank(josh);
        weth.transfer(address(compoundingStakingSSVStrategy), amount);

        vm.prank(address(oethVault));
        compoundingStakingSSVStrategy.deposit(address(mockWeth), amount);

        assertEq(compoundingStakingSSVStrategy.depositedWethAccountedFor(), amount);
    }

    /// @dev Fuzz checkBalance with varying WETH
    function testFuzz_checkBalance(uint256 wethAmount) public {
        wethAmount = bound(wethAmount, 0, 10_000 ether);

        if (wethAmount > 0) {
            vm.prank(josh);
            weth.transfer(address(compoundingStakingSSVStrategy), wethAmount);
        }

        // checkBalance = lastVerifiedEthBalance (0) + WETH balance
        assertEq(compoundingStakingSSVStrategy.checkBalance(address(mockWeth)), wethAmount);
    }
}

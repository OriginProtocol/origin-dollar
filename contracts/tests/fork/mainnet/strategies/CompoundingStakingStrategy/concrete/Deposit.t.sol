// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Fork_CompoundingStakingStrategy_Shared_Test
} from "tests/fork/mainnet/strategies/CompoundingStakingStrategy/shared/Shared.t.sol";
import {ICompoundingStakingStrategy} from "contracts/interfaces/strategies/ICompoundingStakingStrategy.sol";

contract Fork_Concrete_CompoundingStakingStrategy_Deposit_Test is Fork_CompoundingStakingStrategy_Shared_Test {
    function test_depositAll_viaVault() public {
        uint256 amount = 32.25 ether;
        uint256 wethBalanceBefore = weth.balanceOf(address(strategy));
        uint256 accountedBefore = strategy.depositedWethAccountedFor();
        uint256 strategyBalanceBefore = strategy.checkBalance(address(weth));

        vm.expectEmit(true, false, false, true, address(strategy));
        emit ICompoundingStakingStrategy.Deposit(address(weth), address(0), amount);
        _depositToStrategy(amount);

        assertEq(weth.balanceOf(address(strategy)), wethBalanceBefore + amount, "strategy WETH not increased");
        assertEq(strategy.depositedWethAccountedFor(), accountedBefore + amount, "deposited WETH not accounted");
        assertEq(strategy.checkBalance(address(weth)), strategyBalanceBefore + amount, "strategy balance not increased");
    }

    function test_depositAll_emitsOnlyNewWeth() public {
        _depositToStrategy(20 ether);

        vm.expectEmit(true, false, false, true, address(strategy));
        emit ICompoundingStakingStrategy.Deposit(address(weth), address(0), 10 ether);
        _depositToStrategy(10 ether);
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OUSDCurveAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Smoke_Concrete_OUSDCurveAMOStrategy_Deposit_Test is Smoke_OUSDCurveAMOStrategy_Shared_Test {
    function test_deposit_increasesCheckBalance() public {
        uint256 balanceBefore = curveAMOStrategy.checkBalance(address(usdc));
        _depositToStrategy(10_000e6);
        uint256 balanceAfter = curveAMOStrategy.checkBalance(address(usdc));
        assertGt(balanceAfter, balanceBefore, "checkBalance should increase after deposit");
    }

    function test_deposit_increasesCheckBalanceByAmount() public {
        // Deposit adds both hardAsset and minted OTokens, so checkBalance increases by ~1x-2x of amount
        uint256 amount = 1_000e6;
        uint256 balanceBefore = curveAMOStrategy.checkBalance(address(usdc));
        _depositToStrategy(amount);
        uint256 balanceAfter = curveAMOStrategy.checkBalance(address(usdc));
        uint256 delta = balanceAfter - balanceBefore;
        assertGe(delta, amount, "checkBalance should increase by at least amount");
        assertLe(delta, amount * 3, "checkBalance should not increase by more than 3x amount");
    }

    function test_depositAll_depositsEntireBalance() public {
        deal(address(usdc), address(curveAMOStrategy), 5_000e6);
        vm.prank(address(ousdVault));
        curveAMOStrategy.depositAll();
        assertEq(usdc.balanceOf(address(curveAMOStrategy)), 0, "USDC balance should be 0 after depositAll");
    }

    function test_deposit_gaugeBalanceIncreases() public {
        uint256 gaugeBefore = curveAMOStrategy.gauge().balanceOf(address(curveAMOStrategy));
        _depositToStrategy(10_000e6);
        uint256 gaugeAfter = curveAMOStrategy.gauge().balanceOf(address(curveAMOStrategy));
        assertGt(gaugeAfter, gaugeBefore, "Gauge balance should increase after deposit");
    }
}

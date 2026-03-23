// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_BaseCurveAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Smoke_Concrete_BaseCurveAMOStrategy_Deposit_Test is Smoke_BaseCurveAMOStrategy_Shared_Test {
    function test_deposit_increasesCheckBalance() public {
        uint256 balanceBefore = baseCurveAMOStrategy.checkBalance(address(weth));
        _depositToStrategy(10 ether);
        uint256 balanceAfter = baseCurveAMOStrategy.checkBalance(address(weth));
        assertGt(balanceAfter, balanceBefore, "checkBalance should increase after deposit");
    }

    function test_deposit_increasesCheckBalanceByAmount() public {
        // Deposit adds both WETH and minted OETHb, so checkBalance increases by ~1x-2x of amount
        uint256 amount = 1 ether;
        uint256 balanceBefore = baseCurveAMOStrategy.checkBalance(address(weth));
        _depositToStrategy(amount);
        uint256 balanceAfter = baseCurveAMOStrategy.checkBalance(address(weth));
        uint256 delta = balanceAfter - balanceBefore;
        assertGe(delta, amount, "checkBalance should increase by at least amount");
        assertLe(delta, amount * 3, "checkBalance should not increase by more than 3x amount");
    }

    function test_depositAll_depositsEntireBalance() public {
        deal(address(weth), address(baseCurveAMOStrategy), 5 ether);
        vm.prank(address(oethBaseVault));
        baseCurveAMOStrategy.depositAll();
        assertEq(weth.balanceOf(address(baseCurveAMOStrategy)), 0, "WETH balance should be 0 after depositAll");
    }

    function test_deposit_gaugeBalanceIncreases() public {
        uint256 gaugeBefore = baseCurveAMOStrategy.gauge().balanceOf(address(baseCurveAMOStrategy));
        _depositToStrategy(10 ether);
        uint256 gaugeAfter = baseCurveAMOStrategy.gauge().balanceOf(address(baseCurveAMOStrategy));
        assertGt(gaugeAfter, gaugeBefore, "Gauge balance should increase after deposit");
    }
}

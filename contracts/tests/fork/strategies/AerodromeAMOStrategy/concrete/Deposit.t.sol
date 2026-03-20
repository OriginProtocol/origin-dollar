// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_AerodromeAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Base as BaseAddresses} from "tests/utils/Addresses.sol";

contract Fork_AerodromeAMOStrategy_Deposit_Test is Fork_AerodromeAMOStrategy_Shared_Test {
    function test_deposit() public {
        (uint256 wethBefore,) = aerodromeAMOStrategy.getPositionPrincipal();

        _depositAsVault(5 ether);
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);

        (uint256 wethAfter,) = aerodromeAMOStrategy.getPositionPrincipal();
        assertGt(wethAfter, wethBefore, "Position principal should increase");

        _verifyEndConditions(true);
    }

    function test_deposit_checkBalanceReflectsDeposit() public {
        uint256 balanceBefore = aerodromeAMOStrategy.checkBalance(BaseAddresses.WETH);

        _depositAsVault(5 ether);
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);

        uint256 balanceAfter = aerodromeAMOStrategy.checkBalance(BaseAddresses.WETH);
        assertGt(balanceAfter, balanceBefore, "checkBalance should increase after deposit");

        _verifyEndConditions(true);
    }

    function test_deposit_noResidualTokensInStrategy() public {
        _depositAsVault(5 ether);
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);

        assertLe(
            IERC20(BaseAddresses.WETH).balanceOf(address(aerodromeAMOStrategy)),
            0.00001 ether,
            "Too much WETH residual"
        );
        assertEq(oethBase.balanceOf(address(aerodromeAMOStrategy)), 0, "OETHb residual should be 0");
    }

    function test_deposit_multipleSequentialDeposits() public {
        // First deposit + rebalance
        _depositAsVault(5 ether);
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);
        _verifyEndConditions(true);

        // Second deposit + rebalance
        _depositAsVault(5 ether);
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);
        _verifyEndConditions(true);
    }

    function test_deposit_triggersRebalanceWhenPoolInRange() public {
        // deposit calls _rebalance internally when pool price is in expected range
        uint256 balanceBefore = aerodromeAMOStrategy.checkBalance(BaseAddresses.WETH);

        _depositAsVault(5 ether);

        // Since pool is in range, deposit should auto-rebalance
        uint256 balanceAfter = aerodromeAMOStrategy.checkBalance(BaseAddresses.WETH);
        assertGt(balanceAfter, balanceBefore, "Deposit should trigger rebalance when in range");

        _verifyEndConditions(true);
    }

    function test_depositAll() public {
        // Deal WETH directly to strategy
        deal(BaseAddresses.WETH, address(aerodromeAMOStrategy), 5 ether);

        uint256 balanceBefore = aerodromeAMOStrategy.checkBalance(BaseAddresses.WETH);

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.depositAll();

        uint256 balanceAfter = aerodromeAMOStrategy.checkBalance(BaseAddresses.WETH);
        assertGt(balanceAfter, balanceBefore, "depositAll should increase balance");
    }

    function test_depositAll_noOpWhenEmpty() public {
        uint256 balanceBefore = aerodromeAMOStrategy.checkBalance(BaseAddresses.WETH);

        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.depositAll();

        uint256 balanceAfter = aerodromeAMOStrategy.checkBalance(BaseAddresses.WETH);
        assertEq(balanceAfter, balanceBefore, "depositAll with no WETH should be no-op");
    }
}

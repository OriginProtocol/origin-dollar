// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_AerodromeAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {Base as BaseAddresses} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_AerodromeAMOStrategy_Deposit_Test is Smoke_AerodromeAMOStrategy_Shared_Test {
    function test_deposit_increasesCheckBalance() public {
        uint256 balanceBefore = aerodromeAMOStrategy.checkBalance(address(weth));
        _depositToStrategy(5 ether);
        uint256 balanceAfter = aerodromeAMOStrategy.checkBalance(address(weth));
        assertGt(balanceAfter, balanceBefore, "checkBalance should increase after deposit");
    }

    function test_deposit_increasesCheckBalanceByAmount() public {
        uint256 amount = 1 ether;
        uint256 balanceBefore = aerodromeAMOStrategy.checkBalance(address(weth));

        deal(address(weth), address(aerodromeAMOStrategy), amount);
        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.deposit(address(weth), amount);

        uint256 balanceAfter = aerodromeAMOStrategy.checkBalance(address(weth));
        // When pool is out of range, deposit parks WETH on the contract, so checkBalance increases by exactly the amount
        // When in range, auto-rebalance adds to position, but checkBalance still increases
        assertApproxEqAbs(
            balanceAfter - balanceBefore, amount, 0.01 ether, "checkBalance should increase by ~amount"
        );
    }

    function test_deposit_triggersRebalanceWhenInRange() public {
        _pushPoolPriceIntoRange();
        _widenAllowedWethShareInterval();

        uint256 amount = 1 ether;
        deal(address(weth), address(aerodromeAMOStrategy), amount);
        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.deposit(address(weth), amount);

        // When pool is in range, deposit triggers internal rebalance which adds WETH to the position.
        // After rebalance, residual WETH on the strategy should be dust.
        assertLe(
            weth.balanceOf(address(aerodromeAMOStrategy)),
            0.00001 ether,
            "WETH should be deployed to position (not sitting on contract)"
        );
    }

    function test_deposit_RevertWhen_notVault() public {
        deal(address(weth), address(aerodromeAMOStrategy), 1 ether);
        vm.expectRevert("Caller is not the Vault");
        aerodromeAMOStrategy.deposit(address(weth), 1 ether);
    }

    function test_deposit_RevertWhen_unsupportedAsset() public {
        vm.prank(address(oethBaseVault));
        vm.expectRevert("Unsupported asset");
        aerodromeAMOStrategy.deposit(BaseAddresses.AERO, 1 ether);
    }

    function test_deposit_RevertWhen_zeroAmount() public {
        vm.prank(address(oethBaseVault));
        vm.expectRevert("Must deposit something");
        aerodromeAMOStrategy.deposit(address(weth), 0);
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Sonic} from "tests/utils/Addresses.sol";
import {
    Fork_SonicSwapXAMOStrategy_Shared_Test
} from "tests/fork/sonic/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";

contract Fork_Concrete_SonicSwapXAMOStrategy_Deposit_Test is Fork_SonicSwapXAMOStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- BASIC DEPOSIT
    //////////////////////////////////////////////////////

    function test_deposit() public {
        uint256 amount = 2000 ether;

        (uint256 wsReservesBefore, uint256 osReservesBefore,) = swapXPool.getReserves();
        uint256 expectedOS = amount * osReservesBefore / wsReservesBefore;

        _depositAsVault(amount);

        // Pool reserves should increase
        (uint256 wsReservesAfter, uint256 osReservesAfter,) = swapXPool.getReserves();
        assertEq(wsReservesAfter, wsReservesBefore + amount);
        assertEq(osReservesAfter, osReservesBefore + expectedOS);
    }

    function test_deposit_afterInitialDeposit() public {
        // First deposit
        _depositAsVault(5000 ether);
        uint256 gaugeBal1 = swapXGauge.balanceOf(address(sonicSwapXAMOStrategy));
        uint256 checkBal1 = sonicSwapXAMOStrategy.checkBalance(Sonic.wS);

        // Second deposit
        _depositAsVault(5000 ether);
        uint256 gaugeBal2 = swapXGauge.balanceOf(address(sonicSwapXAMOStrategy));
        uint256 checkBal2 = sonicSwapXAMOStrategy.checkBalance(Sonic.wS);

        assertGt(gaugeBal2, gaugeBal1);
        assertGt(checkBal2, checkBal1);
    }

    //////////////////////////////////////////////////////
    /// --- ACCESS CONTROL
    //////////////////////////////////////////////////////

    function test_deposit_RevertWhen_notVault() public {
        uint256 amount = 50 ether;
        vm.prank(clement);
        IERC20(Sonic.wS).transfer(address(sonicSwapXAMOStrategy), amount);

        address[3] memory unauthorized = [strategist, governor, nick];
        for (uint256 i = 0; i < unauthorized.length; i++) {
            vm.prank(unauthorized[i]);
            vm.expectRevert("Caller is not the Vault");
            sonicSwapXAMOStrategy.deposit(Sonic.wS, amount);
        }
    }

    function test_depositAll_RevertWhen_notVault() public {
        uint256 amount = 50 ether;
        vm.prank(clement);
        IERC20(Sonic.wS).transfer(address(sonicSwapXAMOStrategy), amount);

        address[3] memory unauthorized = [strategist, governor, nick];
        for (uint256 i = 0; i < unauthorized.length; i++) {
            vm.prank(unauthorized[i]);
            vm.expectRevert("Caller is not the Vault");
            sonicSwapXAMOStrategy.depositAll();
        }
    }

    function test_depositAll() public {
        uint256 amount = 50 ether;
        vm.prank(clement);
        IERC20(Sonic.wS).transfer(address(sonicSwapXAMOStrategy), amount);

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.depositAll();

        assertGt(swapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertEq(IERC20(Sonic.wS).balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    //////////////////////////////////////////////////////
    /// --- REVERT CASES
    //////////////////////////////////////////////////////

    function test_deposit_RevertWhen_zeroAmount() public {
        vm.prank(address(oSonicVault));
        vm.expectRevert("Must deposit something");
        sonicSwapXAMOStrategy.deposit(Sonic.wS, 0);
    }

    function test_deposit_RevertWhen_unsupportedAsset() public {
        vm.prank(address(oSonicVault));
        vm.expectRevert("Unsupported asset");
        sonicSwapXAMOStrategy.deposit(address(oSonic), 1 ether);
    }

    function test_deposit_RevertWhen_poolHasLotMoreOS() public {
        // Tilt pool heavily toward OS
        _tiltPoolToMoreOS(1_000_000 ether);

        uint256 amount = 5000 ether;
        vm.prank(clement);
        IERC20(Sonic.wS).transfer(address(sonicSwapXAMOStrategy), amount);

        vm.prank(address(oSonicVault));
        vm.expectRevert("price out of range");
        sonicSwapXAMOStrategy.deposit(Sonic.wS, amount);
    }

    function test_deposit_RevertWhen_poolHasLotMoreWS() public {
        // Tilt pool heavily toward wS
        _tiltPoolToMoreWS(2_000_000 ether);

        uint256 amount = 6000 ether;
        vm.prank(clement);
        IERC20(Sonic.wS).transfer(address(sonicSwapXAMOStrategy), amount);

        vm.prank(address(oSonicVault));
        vm.expectRevert("price out of range");
        sonicSwapXAMOStrategy.deposit(Sonic.wS, amount);
    }

    //////////////////////////////////////////////////////
    /// --- SLIGHTLY TILTED POOL
    //////////////////////////////////////////////////////

    function test_deposit_poolWithLittleMoreOS() public {
        _tiltPoolToMoreOS(5000 ether);

        uint256 gaugeBefore = swapXGauge.balanceOf(address(sonicSwapXAMOStrategy));
        _depositAsVault(12_000 ether);

        assertGt(swapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), gaugeBefore);
        assertEq(IERC20(Sonic.wS).balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_deposit_poolWithLittleMoreWS() public {
        _tiltPoolToMoreWS(20_000 ether);

        uint256 gaugeBefore = swapXGauge.balanceOf(address(sonicSwapXAMOStrategy));
        _depositAsVault(18_000 ether);

        assertGt(swapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), gaugeBefore);
        assertEq(IERC20(Sonic.wS).balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    //////////////////////////////////////////////////////
    /// --- STATE ASSERTIONS
    //////////////////////////////////////////////////////

    function test_deposit_noResidualTokens() public {
        _depositAsVault(5000 ether);

        assertEq(IERC20(Sonic.wS).balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertEq(IERC20(address(swapXPool)).balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_deposit_mintsCorrectOS() public {
        uint256 amount = 5000 ether;

        (uint256 wsReserves, uint256 osReserves,) = swapXPool.getReserves();
        uint256 expectedOS = amount * osReserves / wsReserves;
        uint256 osSupplyBefore = oSonic.totalSupply();

        _depositAsVault(amount);

        uint256 osMinted = oSonic.totalSupply() - osSupplyBefore;
        assertEq(osMinted, expectedOS);
    }

    function test_deposit_gaugeBalanceIncreases() public {
        uint256 gaugeBefore = swapXGauge.balanceOf(address(sonicSwapXAMOStrategy));
        _depositAsVault(5000 ether);

        assertGt(swapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), gaugeBefore);
    }

    function test_deposit_poolReservesIncrease() public {
        uint256 amount = 5000 ether;
        (uint256 wsReservesBefore, uint256 osReservesBefore,) = swapXPool.getReserves();

        _depositAsVault(amount);

        (uint256 wsReservesAfter, uint256 osReservesAfter,) = swapXPool.getReserves();
        assertGt(wsReservesAfter, wsReservesBefore);
        assertGt(osReservesAfter, osReservesBefore);
    }

    function test_deposit_checkBalanceIncreases() public {
        uint256 checkBefore = sonicSwapXAMOStrategy.checkBalance(Sonic.wS);
        _depositAsVault(5000 ether);

        assertGt(sonicSwapXAMOStrategy.checkBalance(Sonic.wS), checkBefore);
    }

    //////////////////////////////////////////////////////
    /// --- INSOLVENCY
    //////////////////////////////////////////////////////

    function test_deposit_RevertWhen_protocolInsolvent() public {
        _makeInsolvent();

        uint256 amount = 10 ether;
        vm.prank(clement);
        IERC20(Sonic.wS).transfer(address(sonicSwapXAMOStrategy), amount);

        vm.prank(address(oSonicVault));
        vm.expectRevert("Protocol insolvent");
        sonicSwapXAMOStrategy.deposit(Sonic.wS, amount);
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Fork_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/fork/mainnet/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";

// --- Test utilities
import {Mainnet} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Fork_Concrete_OETHSupernovaAMOStrategy_Deposit_Test is Fork_OETHSupernovaAMOStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- BASIC DEPOSIT
    //////////////////////////////////////////////////////

    function test_deposit() public {
        uint256 amount = 2000 ether;

        (uint256 reserve0Before, uint256 reserve1Before,) = supernovaPool.getReserves();
        (uint256 wethReservesBefore, uint256 oethReservesBefore) = _orderReserves(reserve0Before, reserve1Before);
        uint256 expectedOETH = (amount * oethReservesBefore) / wethReservesBefore;

        _depositAsVault(amount);

        // Pool reserves should increase
        (uint256 reserve0After, uint256 reserve1After,) = supernovaPool.getReserves();
        (uint256 wethReservesAfter, uint256 oethReservesAfter) = _orderReserves(reserve0After, reserve1After);
        assertEq(wethReservesAfter, wethReservesBefore + amount);
        assertEq(oethReservesAfter, oethReservesBefore + expectedOETH);
    }

    function test_deposit_afterInitialDeposit() public {
        // First deposit
        _depositAsVault(5000 ether);
        uint256 gaugeBal1 = supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy));
        uint256 checkBal1 = oethSupernovaAMOStrategy.checkBalance(Mainnet.WETH);

        // Second deposit
        _depositAsVault(5000 ether);
        uint256 gaugeBal2 = supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy));
        uint256 checkBal2 = oethSupernovaAMOStrategy.checkBalance(Mainnet.WETH);

        assertGt(gaugeBal2, gaugeBal1);
        assertGt(checkBal2, checkBal1);
    }

    //////////////////////////////////////////////////////
    /// --- ACCESS CONTROL
    //////////////////////////////////////////////////////

    function test_deposit_RevertWhen_notVault() public {
        uint256 amount = 50 ether;
        vm.prank(clement);
        IERC20(Mainnet.WETH).transfer(address(oethSupernovaAMOStrategy), amount);

        address[3] memory unauthorized = [strategist, governor, nick];
        for (uint256 i = 0; i < unauthorized.length; i++) {
            vm.prank(unauthorized[i]);
            vm.expectRevert("Caller is not the Vault");
            oethSupernovaAMOStrategy.deposit(Mainnet.WETH, amount);
        }
    }

    function test_depositAll_RevertWhen_notVault() public {
        uint256 amount = 50 ether;
        vm.prank(clement);
        IERC20(Mainnet.WETH).transfer(address(oethSupernovaAMOStrategy), amount);

        address[3] memory unauthorized = [strategist, governor, nick];
        for (uint256 i = 0; i < unauthorized.length; i++) {
            vm.prank(unauthorized[i]);
            vm.expectRevert("Caller is not the Vault");
            oethSupernovaAMOStrategy.depositAll();
        }
    }

    function test_depositAll() public {
        uint256 amount = 50 ether;
        vm.prank(clement);
        IERC20(Mainnet.WETH).transfer(address(oethSupernovaAMOStrategy), amount);

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.depositAll();

        assertGt(supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertEq(IERC20(Mainnet.WETH).balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    //////////////////////////////////////////////////////
    /// --- REVERT CASES
    //////////////////////////////////////////////////////

    function test_deposit_RevertWhen_zeroAmount() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Must deposit something");
        oethSupernovaAMOStrategy.deposit(Mainnet.WETH, 0);
    }

    function test_deposit_RevertWhen_unsupportedAsset() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Unsupported asset");
        oethSupernovaAMOStrategy.deposit(address(oeth), 1 ether);
    }

    function test_deposit_RevertWhen_poolHasLotMoreOETH() public {
        // Tilt pool heavily toward OETH
        _tiltPoolToMoreOETH(1_000_000 ether);

        uint256 amount = 5000 ether;
        vm.prank(clement);
        IERC20(Mainnet.WETH).transfer(address(oethSupernovaAMOStrategy), amount);

        vm.prank(address(oethVault));
        vm.expectRevert("price out of range");
        oethSupernovaAMOStrategy.deposit(Mainnet.WETH, amount);
    }

    function test_deposit_RevertWhen_poolHasLotMoreWETH() public {
        // Tilt pool heavily toward WETH
        _tiltPoolToMoreWETH(2_000_000 ether);

        uint256 amount = 6000 ether;
        vm.prank(clement);
        IERC20(Mainnet.WETH).transfer(address(oethSupernovaAMOStrategy), amount);

        vm.prank(address(oethVault));
        vm.expectRevert("price out of range");
        oethSupernovaAMOStrategy.deposit(Mainnet.WETH, amount);
    }

    //////////////////////////////////////////////////////
    /// --- SLIGHTLY TILTED POOL
    //////////////////////////////////////////////////////

    function test_deposit_poolWithLittleMoreOETH() public {
        // Small tilt relative to ~150 ETH pool (matches Hardhat littleMoreOToken: 2)
        _tiltPoolToMoreOETH(2 ether);

        uint256 gaugeBefore = supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy));
        _depositAsVault(12 ether);

        assertGt(supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy)), gaugeBefore);
        assertEq(IERC20(Mainnet.WETH).balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_deposit_poolWithLittleMoreWETH() public {
        // Small tilt relative to ~150 ETH pool (matches Hardhat littleMoreAsset: 2)
        _tiltPoolToMoreWETH(2 ether);

        uint256 gaugeBefore = supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy));
        _depositAsVault(18 ether);

        assertGt(supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy)), gaugeBefore);
        assertEq(IERC20(Mainnet.WETH).balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    //////////////////////////////////////////////////////
    /// --- STATE ASSERTIONS
    //////////////////////////////////////////////////////

    function test_deposit_noResidualTokens() public {
        _depositAsVault(5000 ether);

        assertEq(IERC20(Mainnet.WETH).balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertEq(IERC20(address(supernovaPool)).balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_deposit_mintsCorrectOETH() public {
        uint256 amount = 5000 ether;

        (uint256 reserve0, uint256 reserve1,) = supernovaPool.getReserves();
        (uint256 wethReserves, uint256 oethReserves) = _orderReserves(reserve0, reserve1);
        uint256 expectedOETH = (amount * oethReserves) / wethReserves;
        uint256 oethSupplyBefore = oeth.totalSupply();

        _depositAsVault(amount);

        uint256 oethMinted = oeth.totalSupply() - oethSupplyBefore;
        assertEq(oethMinted, expectedOETH);
    }

    function test_deposit_gaugeBalanceIncreases() public {
        uint256 gaugeBefore = supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy));
        _depositAsVault(5000 ether);

        assertGt(supernovaGauge.balanceOf(address(oethSupernovaAMOStrategy)), gaugeBefore);
    }

    function test_deposit_poolReservesIncrease() public {
        uint256 amount = 5000 ether;
        (uint256 reserve0Before, uint256 reserve1Before,) = supernovaPool.getReserves();
        (uint256 wethReservesBefore, uint256 oethReservesBefore) = _orderReserves(reserve0Before, reserve1Before);

        _depositAsVault(amount);

        (uint256 reserve0After, uint256 reserve1After,) = supernovaPool.getReserves();
        (uint256 wethReservesAfter, uint256 oethReservesAfter) = _orderReserves(reserve0After, reserve1After);
        assertGt(wethReservesAfter, wethReservesBefore);
        assertGt(oethReservesAfter, oethReservesBefore);
    }

    function test_deposit_checkBalanceIncreases() public {
        uint256 checkBefore = oethSupernovaAMOStrategy.checkBalance(Mainnet.WETH);
        _depositAsVault(5000 ether);

        assertGt(oethSupernovaAMOStrategy.checkBalance(Mainnet.WETH), checkBefore);
    }

    //////////////////////////////////////////////////////
    /// --- INSOLVENCY
    //////////////////////////////////////////////////////

    function test_deposit_RevertWhen_protocolInsolvent() public {
        _makeInsolvent();

        uint256 amount = 10 ether;
        vm.prank(clement);
        IERC20(Mainnet.WETH).transfer(address(oethSupernovaAMOStrategy), amount);

        vm.prank(address(oethVault));
        vm.expectRevert("Protocol insolvent");
        oethSupernovaAMOStrategy.deposit(Mainnet.WETH, amount);
    }
}

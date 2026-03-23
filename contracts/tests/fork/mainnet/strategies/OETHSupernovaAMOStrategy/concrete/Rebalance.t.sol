// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Mainnet} from "tests/utils/Addresses.sol";
import {
    Fork_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/fork/mainnet/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";
import {OETHSupernovaAMOStrategy} from "contracts/strategies/algebra/OETHSupernovaAMOStrategy.sol";

contract Fork_Concrete_OETHSupernovaAMOStrategy_Rebalance_Test is Fork_OETHSupernovaAMOStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- swapAssetsToPool (pool has more OETH, swap WETH in)
    //////////////////////////////////////////////////////

    function test_swapAssetsToPool_small() public {
        _depositAsVault(5000 ether);
        _tiltPoolToMoreOETH(1_000_000 ether);

        uint256 vaultWETHBefore = IERC20(Mainnet.WETH).balanceOf(address(oethVault));

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapAssetsToPool(3 ether);

        // Vault WETH balance unchanged
        assertEq(IERC20(Mainnet.WETH).balanceOf(address(oethVault)), vaultWETHBefore);
        // No residual tokens
        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertEq(IERC20(address(supernovaPool)).balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_swapAssetsToPool_closeToBalanced() public {
        _depositAsVault(100_000 ether);
        _tiltPoolToMoreOETH(1_000_000 ether);

        (uint256 reserve0, uint256 reserve1,) = supernovaPool.getReserves();
        (uint256 wethReserves, uint256 oethReserves) = _orderReserves(reserve0, reserve1);
        // 5% of the extra OETH
        uint256 extraOETH = oethReserves - wethReserves;
        uint256 wethAmount = (((extraOETH * 5) / 100) * wethReserves) / oethReserves;

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapAssetsToPool(wethAmount);

        // Pool should be more balanced
        (uint256 reserve0After, uint256 reserve1After,) = supernovaPool.getReserves();
        (uint256 wethAfter, uint256 oethAfter) = _orderReserves(reserve0After, reserve1After);
        uint256 diffAfter = oethAfter > wethAfter ? oethAfter - wethAfter : wethAfter - oethAfter;
        assertLt(diffAfter, extraOETH);
        // No residual tokens
        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_swapAssetsToPool_large() public {
        _depositAsVault(5000 ether);
        _tiltPoolToMoreOETH(1_000_000 ether);

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapAssetsToPool(3000 ether);

        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertEq(IERC20(address(supernovaPool)).balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_swapAssetsToPool_mostOfBalance() public {
        _depositAsVault(5000 ether);
        _tiltPoolToMoreOETH(1_000_000 ether);

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapAssetsToPool(4400 ether);

        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_swapAssetsToPool_RevertWhen_insufficientLP() public {
        _depositAsVault(5000 ether);
        _tiltPoolToMoreOETH(1_000_000 ether);

        vm.prank(strategist);
        vm.expectRevert("Not enough LP tokens in gauge");
        oethSupernovaAMOStrategy.swapAssetsToPool(2_000_000 ether);
    }

    function test_swapOTokensToPool_RevertWhen_poolHasMoreOETH() public {
        _depositAsVault(5000 ether);
        _tiltPoolToMoreOETH(1_000_000 ether);

        // Trying to swap OETH when pool already has more OETH should worsen balance
        vm.prank(strategist);
        vm.expectRevert("OTokens balance worse");
        oethSupernovaAMOStrategy.swapOTokensToPool(0.001 ether);
    }

    function test_swapAssetsToPool_RevertWhen_overshotPeg() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreOETH(5000 ether);

        // Swap too much WETH, overshooting the peg
        vm.prank(strategist);
        vm.expectRevert("Assets overshot peg");
        oethSupernovaAMOStrategy.swapAssetsToPool(5000 ether);
    }

    function test_swapAssetsToPool_RevertWhen_zeroAmount() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreOETH(5000 ether);

        vm.prank(strategist);
        vm.expectRevert("Must swap something");
        oethSupernovaAMOStrategy.swapAssetsToPool(0);
    }

    function test_swapAssetsToPool_noResidualTokens() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreOETH(5000 ether);

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapAssetsToPool(3 ether);

        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertEq(IERC20(address(supernovaPool)).balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_swapAssetsToPool_RevertWhen_protocolInsolvent() public {
        _makeInsolvent();

        // Add more OETH to pool to enable swapAssetsToPool direction
        _tiltPoolToMoreOETH(100_000 ether);

        // Deepen insolvency significantly so that the OToken burn from
        // swapAssetsToPool cannot restore solvency
        vm.prank(address(oethVault));
        oeth.mint(alice, 100_000 ether);

        vm.prank(strategist);
        vm.expectRevert("Protocol insolvent");
        oethSupernovaAMOStrategy.swapAssetsToPool(10 ether);
    }

    //////////////////////////////////////////////////////
    /// --- swapAssetsToPool revert when pool has more WETH
    //////////////////////////////////////////////////////

    function test_swapAssetsToPool_RevertWhen_poolHasMoreWETH() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreWETH(20_000 ether);

        // Trying to swap WETH when pool already has more WETH should worsen balance
        vm.prank(strategist);
        vm.expectRevert("Assets balance worse");
        oethSupernovaAMOStrategy.swapAssetsToPool(0.0001 ether);
    }

    //////////////////////////////////////////////////////
    /// --- swapOTokensToPool (pool has more WETH, swap OETH in)
    //////////////////////////////////////////////////////

    function test_swapOTokensToPool_small() public {
        _depositAsVault(5000 ether);
        _tiltPoolToMoreWETH(2_000_000 ether);

        uint256 vaultWETHBefore = IERC20(Mainnet.WETH).balanceOf(address(oethVault));

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapOTokensToPool(0.3 ether);

        // Vault WETH balance unchanged
        assertEq(IERC20(Mainnet.WETH).balanceOf(address(oethVault)), vaultWETHBefore);
        // No residual tokens
        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertEq(IERC20(address(supernovaPool)).balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_swapOTokensToPool_large() public {
        _depositAsVault(5000 ether);
        _tiltPoolToMoreWETH(2_000_000 ether);

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapOTokensToPool(5000 ether);

        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertEq(IERC20(address(supernovaPool)).balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_swapOTokensToPool_closeToBalanced() public {
        _depositAsVault(5000 ether);
        _tiltPoolToMoreWETH(2_000_000 ether);

        (uint256 reserve0, uint256 reserve1,) = supernovaPool.getReserves();
        (uint256 wethReserves, uint256 oethReserves) = _orderReserves(reserve0, reserve1);
        // Use a small fraction of the extra WETH to avoid overshooting peg.
        // In a sAMM pool, swapping OTokens returns proportionally more asset
        // so a small swap amount already moves the pool significantly.
        uint256 oethAmount = ((wethReserves - oethReserves) * 1) / 100;

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapOTokensToPool(oethAmount);

        // Pool should be more balanced
        (uint256 reserve0After, uint256 reserve1After,) = supernovaPool.getReserves();
        (uint256 wethAfter, uint256 oethAfter) = _orderReserves(reserve0After, reserve1After);
        uint256 diffBefore = wethReserves - oethReserves;
        uint256 diffAfter = wethAfter > oethAfter ? wethAfter - oethAfter : oethAfter - wethAfter;
        assertLt(diffAfter, diffBefore);
    }

    function test_swapOTokensToPool_RevertWhen_overshotPeg() public {
        _depositAsVault(50 ether);
        // Use Hardhat's lotMoreAsset value (400 ether) for ~150 ETH pool
        _tiltPoolToMoreWETH(400 ether);

        // Swap enough OETH to overshoot the peg without causing insolvency
        vm.prank(strategist);
        vm.expectRevert("OTokens overshot peg");
        oethSupernovaAMOStrategy.swapOTokensToPool(350 ether);
    }

    function test_swapOTokensToPool_RevertWhen_zeroAmount() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreWETH(20_000 ether);

        vm.prank(strategist);
        vm.expectRevert("Must swap something");
        oethSupernovaAMOStrategy.swapOTokensToPool(0);
    }

    function test_swapOTokensToPool_noResidualTokens() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreWETH(20_000 ether);

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapOTokensToPool(8 ether);

        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        assertEq(IERC20(address(supernovaPool)).balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_swapOTokensToPool_RevertWhen_protocolInsolvent() public {
        // Make insolvent first (while pool is balanced, so deposit in _makeInsolvent succeeds)
        _makeInsolvent();

        // Then tilt pool to enable swapOTokensToPool direction
        _tiltPoolToMoreWETH(100_000 ether);

        // Deepen insolvency so that the OToken mint + deposit in swapOTokensToPool
        // cannot restore solvency
        vm.prank(address(oethVault));
        oeth.mint(alice, 100_000 ether);

        vm.prank(strategist);
        vm.expectRevert("Protocol insolvent");
        oethSupernovaAMOStrategy.swapOTokensToPool(0.1 ether);
    }

    //////////////////////////////////////////////////////
    /// --- swapOTokensToPool revert with little more WETH
    //////////////////////////////////////////////////////

    function test_swapOTokensToPool_RevertWhen_overshotPeg_littleMore() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreWETH(20_000 ether);

        vm.prank(strategist);
        vm.expectRevert("OTokens overshot peg");
        oethSupernovaAMOStrategy.swapOTokensToPool(11_000 ether);
    }

    function test_swapAssetsToPool_RevertWhen_poolHasMoreWETH_little() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreWETH(20_000 ether);

        // Trying to swap WETH when pool already has more WETH should worsen balance
        vm.prank(strategist);
        vm.expectRevert("Assets balance worse");
        oethSupernovaAMOStrategy.swapAssetsToPool(0.0001 ether);
    }

    //////////////////////////////////////////////////////
    /// --- swapAssetsToPool with little more OETH
    //////////////////////////////////////////////////////

    function test_swapAssetsToPool_smallWithLittleMoreOETH() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreOETH(5000 ether);

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapAssetsToPool(3 ether);

        assertEq(oeth.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_swapAssetsToPool_closeToBalancedWithLittleMoreOETH() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreOETH(5000 ether);

        (uint256 reserve0, uint256 reserve1,) = supernovaPool.getReserves();
        (uint256 wethReserves, uint256 oethReserves) = _orderReserves(reserve0, reserve1);
        // 50% of the extra OETH gets close to balanced
        uint256 extraOETH = oethReserves - wethReserves;
        uint256 wethAmount = (((extraOETH * 50) / 100) * wethReserves) / oethReserves;

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapAssetsToPool(wethAmount);

        (uint256 reserve0After, uint256 reserve1After,) = supernovaPool.getReserves();
        (uint256 wethAfter, uint256 oethAfter) = _orderReserves(reserve0After, reserve1After);
        uint256 diffAfter = oethAfter > wethAfter ? oethAfter - wethAfter : wethAfter - oethAfter;
        assertLt(diffAfter, extraOETH);
    }

    function test_swapOTokensToPool_RevertWhen_poolHasMoreOETH_little() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreOETH(5000 ether);

        vm.prank(strategist);
        vm.expectRevert("OTokens balance worse");
        oethSupernovaAMOStrategy.swapOTokensToPool(0.001 ether);
    }
}

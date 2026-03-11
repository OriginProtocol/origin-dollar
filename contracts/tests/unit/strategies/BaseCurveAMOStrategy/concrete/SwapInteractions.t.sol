// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BaseCurveAMOStrategy_Shared_Test} from
    "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_BaseCurveAMOStrategy_SwapInteractions_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    /// @dev Helper: perform an external swap of WETH->OETH on the pool
    function _swapWethForOeth(address swapper, uint256 amount) internal {
        deal(address(weth), swapper, amount);
        vm.startPrank(swapper);
        weth.approve(address(curvePool), amount);
        curvePool.exchange(0, 1, amount, 0); // coin0=WETH in, coin1=OETH out
        vm.stopPrank();
    }

    /// @dev Helper: perform an external swap of OETH->WETH on the pool
    function _swapOethForWeth(address swapper, uint256 amount) internal {
        vm.prank(address(oethVault));
        oeth.mint(swapper, amount);
        vm.startPrank(swapper);
        oeth.approve(address(curvePool), amount);
        curvePool.exchange(1, 0, amount, 0); // coin1=OETH in, coin0=WETH out
        vm.stopPrank();
    }

    function test_swapTiltsToWeth_depositMintsMoreOTokens() public {
        _seedVaultForSolvency(1000 ether);
        _setupPoolBalances(100 ether, 100 ether);

        _swapWethForOeth(alice, 50 ether);

        uint256 depositAmount = 10 ether;
        uint256 supplyBefore = oeth.totalSupply();
        _depositAsVault(depositAmount);
        uint256 oethMinted = oeth.totalSupply() - supplyBefore;

        assertGt(oethMinted, depositAmount, "Should mint more than 1x when pool tilted to WETH");
        assertLe(oethMinted, depositAmount * 2, "Should not exceed 2x cap");
    }

    function test_swapTiltsToOeth_depositMintsMinimumOTokens() public {
        _seedVaultForSolvency(1000 ether);
        _setupPoolBalances(100 ether, 100 ether);

        _swapOethForWeth(alice, 50 ether);

        uint256 depositAmount = 10 ether;
        uint256 supplyBefore = oeth.totalSupply();
        _depositAsVault(depositAmount);
        uint256 oethMinted = oeth.totalSupply() - supplyBefore;

        assertEq(oethMinted, depositAmount, "Should mint exactly 1x when pool tilted to OToken");
    }

    function test_swapTiltsToWeth_enablesMintAndAddOTokens() public {
        _seedVaultForSolvency(1000 ether);
        _setupPoolBalances(100 ether, 100 ether);

        _swapWethForOeth(alice, 30 ether);

        vm.prank(strategist);
        baseCurveAMOStrategy.mintAndAddOTokens(20 ether);

        assertGt(curveGauge.balanceOf(address(baseCurveAMOStrategy)), 0);
    }

    function test_swapTiltsToOeth_enablesRemoveAndBurnOTokens() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        _setupPoolBalances(100 ether, 100 ether);
        _swapOethForWeth(alice, 30 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        vm.prank(strategist);
        baseCurveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }

    function test_swapTiltsToWeth_enablesRemoveOnlyAssets() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        _setupPoolBalances(100 ether, 100 ether);
        _swapWethForOeth(alice, 30 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        vm.prank(strategist);
        baseCurveAMOStrategy.removeOnlyAssets(lpToRemove);
    }

    function test_swapTiltsToWeth_blocksRemoveAndBurnOTokens() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        _setupPoolBalances(100 ether, 100 ether);
        _swapWethForOeth(alice, 30 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        vm.prank(strategist);
        vm.expectRevert("Assets balance worse");
        baseCurveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }

    function test_swapTiltsToOeth_blocksRemoveOnlyAssets() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        _setupPoolBalances(100 ether, 100 ether);
        _swapOethForWeth(alice, 30 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(baseCurveAMOStrategy)) / 4;

        vm.prank(strategist);
        vm.expectRevert("OTokens balance worse");
        baseCurveAMOStrategy.removeOnlyAssets(lpToRemove);
    }

    function test_swapChangesCheckBalance() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        uint256 balanceBefore = baseCurveAMOStrategy.checkBalance(address(weth));

        curvePool.setVirtualPrice(1.01e18);

        uint256 balanceAfter = baseCurveAMOStrategy.checkBalance(address(weth));

        assertGt(balanceAfter, balanceBefore, "checkBalance should increase with virtualPrice");
    }

    function test_swapThenWithdraw_recipientGetsExactAmount() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(50 ether);

        _swapWethForOeth(alice, 20 ether);

        uint256 withdrawAmount = 10 ether;
        uint256 vaultBalBefore = weth.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdraw(address(oethVault), address(weth), withdrawAmount);

        assertEq(weth.balanceOf(address(oethVault)) - vaultBalBefore, withdrawAmount);
    }

    function test_multipleSwaps_poolRebalances() public {
        _seedVaultForSolvency(1000 ether);
        _setupPoolBalances(100 ether, 100 ether);

        _swapWethForOeth(alice, 20 ether);

        vm.prank(strategist);
        baseCurveAMOStrategy.mintAndAddOTokens(10 ether);

        _swapOethForWeth(bobby, 15 ether);

        uint256 supplyBefore = oeth.totalSupply();
        _depositAsVault(5 ether);
        uint256 oethMinted = oeth.totalSupply() - supplyBefore;

        assertGe(oethMinted, 5 ether, "Should mint at least 1x");
        assertLe(oethMinted, 10 ether, "Should not exceed 2x");
    }
}

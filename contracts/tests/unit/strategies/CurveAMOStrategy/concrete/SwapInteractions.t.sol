// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CurveAMOStrategy_Shared_Test} from "tests/unit/strategies/CurveAMOStrategy/shared/Shared.t.sol";

/// @title Swap Interaction Tests
/// @notice Tests how external swaps on the CurvePool affect strategy operations.
///         External swaps change pool balance ratios, which impacts the `improvePoolBalance`
///         modifier, deposit OToken calculations, and withdrawal LP-to-asset conversions.
contract Unit_Concrete_CurveAMOStrategy_SwapInteractions_Test is Unit_CurveAMOStrategy_Shared_Test {
    /// @dev Helper: perform an external swap of WETH→OETH on the pool (simulating a user buying OETH)
    function _swapWethForOeth(address swapper, uint256 amount) internal {
        deal(address(weth), swapper, amount);
        vm.startPrank(swapper);
        weth.approve(address(curvePool), amount);
        curvePool.exchange(0, 1, amount, 0); // coin0=WETH in, coin1=OETH out
        vm.stopPrank();
    }

    /// @dev Helper: perform an external swap of OETH→WETH on the pool (simulating a user selling OETH)
    function _swapOethForWeth(address swapper, uint256 amount) internal {
        // Mint OETH to the swapper via vault
        vm.prank(address(oethVault));
        oeth.mint(swapper, amount);
        vm.startPrank(swapper);
        oeth.approve(address(curvePool), amount);
        curvePool.exchange(1, 0, amount, 0); // coin1=OETH in, coin0=WETH out
        vm.stopPrank();
    }

    // -------------------------------------------------------
    // Swap tilts pool → deposit adapts OToken minting ratio
    // -------------------------------------------------------

    function test_swapTiltsToHardAsset_depositMintsMoreOTokens() public {
        _seedVaultForSolvency(1000 ether);
        // Start with balanced pool
        _setupPoolBalances(100 ether, 100 ether);

        // External swap: user buys OETH with WETH → pool gets more WETH, less OETH
        _swapWethForOeth(alice, 50 ether);

        // Pool is now tilted to hardAsset (150 WETH, 50 OETH)
        // Deposit should mint > 1x OTokens to rebalance
        uint256 depositAmount = 10 ether;
        uint256 supplyBefore = oeth.totalSupply();
        _depositAsVault(depositAmount);
        uint256 oethMinted = oeth.totalSupply() - supplyBefore;

        assertGt(oethMinted, depositAmount, "Should mint more than 1x when pool tilted to hardAsset");
        assertLe(oethMinted, depositAmount * 2, "Should not exceed 2x cap");
    }

    function test_swapTiltsToOToken_depositMintsMinimumOTokens() public {
        _seedVaultForSolvency(1000 ether);
        // Start with balanced pool
        _setupPoolBalances(100 ether, 100 ether);

        // External swap: user sells OETH for WETH → pool gets more OETH, less WETH
        _swapOethForWeth(alice, 50 ether);

        // Pool is now tilted to OToken (50 WETH, 150 OETH)
        // Deposit should mint minimum (1x) OTokens
        uint256 depositAmount = 10 ether;
        uint256 supplyBefore = oeth.totalSupply();
        _depositAsVault(depositAmount);
        uint256 oethMinted = oeth.totalSupply() - supplyBefore;

        assertEq(oethMinted, depositAmount, "Should mint exactly 1x when pool tilted to OToken");
    }

    // -------------------------------------------------------
    // Swap tilts pool → enables/blocks rebalancing operations
    // -------------------------------------------------------

    function test_swapTiltsToHardAsset_enablesMintAndAddOTokens() public {
        _seedVaultForSolvency(1000 ether);
        _setupPoolBalances(100 ether, 100 ether);

        // External swap creates hardAsset tilt
        _swapWethForOeth(alice, 30 ether);
        // Pool: ~130 WETH, ~70 OETH → diffBefore > 0

        // mintAndAddOTokens should now be allowed (adds OTokens to reduce hardAsset tilt)
        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(20 ether);

        assertGt(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
    }

    function test_swapTiltsToOToken_enablesRemoveAndBurnOTokens() public {
        _seedVaultForSolvency(1000 ether);
        // Deposit first to have LP tokens
        _depositAsVault(20 ether);

        // Set pool to balanced then swap to create OToken tilt
        _setupPoolBalances(100 ether, 100 ether);
        _swapOethForWeth(alice, 30 ether);
        // Pool: ~70 WETH, ~130 OETH → diffBefore < 0

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        // removeAndBurnOTokens should now be allowed (removes OTokens to reduce OToken tilt)
        vm.prank(strategist);
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }

    function test_swapTiltsToHardAsset_enablesRemoveOnlyAssets() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        // Set pool then swap to create hardAsset tilt
        _setupPoolBalances(100 ether, 100 ether);
        _swapWethForOeth(alice, 30 ether);
        // Pool: ~130 WETH, ~70 OETH → diffBefore > 0

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        // removeOnlyAssets should be allowed (removes hardAsset to reduce hardAsset tilt)
        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);
    }

    function test_swapTiltsToHardAsset_blocksRemoveAndBurnOTokens() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        // Create hardAsset tilt via swap
        _setupPoolBalances(100 ether, 100 ether);
        _swapWethForOeth(alice, 30 ether);
        // Pool: ~130 WETH, ~70 OETH → diffBefore > 0

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        // Removing OTokens would worsen the hardAsset tilt
        vm.prank(strategist);
        vm.expectRevert("Assets balance worse");
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }

    function test_swapTiltsToOToken_blocksRemoveOnlyAssets() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        // Create OToken tilt via swap
        _setupPoolBalances(100 ether, 100 ether);
        _swapOethForWeth(alice, 30 ether);
        // Pool: ~70 WETH, ~130 OETH → diffBefore < 0

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        // Removing hardAsset would worsen the OToken tilt
        vm.prank(strategist);
        vm.expectRevert("OTokens balance worse");
        curveAMOStrategy.removeOnlyAssets(lpToRemove);
    }

    // -------------------------------------------------------
    // Swap changes checkBalance value
    // -------------------------------------------------------

    function test_swapChangesCheckBalance() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(20 ether);

        uint256 balanceBefore = curveAMOStrategy.checkBalance(address(weth));

        // Virtual price increase (simulating swap fees accrued)
        curvePool.setVirtualPrice(1.01e18);

        uint256 balanceAfter = curveAMOStrategy.checkBalance(address(weth));

        // checkBalance uses virtualPrice, so it should increase
        assertGt(balanceAfter, balanceBefore, "checkBalance should increase with virtualPrice");
    }

    // -------------------------------------------------------
    // Swap then withdraw: recipient still gets exact amount
    // -------------------------------------------------------

    function test_swapThenWithdraw_recipientGetsExactAmount() public {
        _seedVaultForSolvency(1000 ether);
        _depositAsVault(50 ether);

        // External swap changes pool ratios
        _swapWethForOeth(alice, 20 ether);

        uint256 withdrawAmount = 10 ether;
        uint256 vaultBalBefore = weth.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        curveAMOStrategy.withdraw(address(oethVault), address(weth), withdrawAmount);

        assertEq(weth.balanceOf(address(oethVault)) - vaultBalBefore, withdrawAmount);
    }

    // -------------------------------------------------------
    // Multiple swaps in different directions
    // -------------------------------------------------------

    function test_multipleSwaps_poolRebalances() public {
        _seedVaultForSolvency(1000 ether);
        _setupPoolBalances(100 ether, 100 ether);

        // Swap 1: user buys OETH → pool tilts to hardAsset
        _swapWethForOeth(alice, 20 ether);

        // Strategist rebalances by adding OTokens
        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(10 ether);

        // Swap 2: user sells OETH → pool tilts back toward OToken
        _swapOethForWeth(bobby, 15 ether);

        // Deposit should still work correctly with the changed pool state
        uint256 supplyBefore = oeth.totalSupply();
        _depositAsVault(5 ether);
        uint256 oethMinted = oeth.totalSupply() - supplyBefore;

        assertGe(oethMinted, 5 ether, "Should mint at least 1x");
        assertLe(oethMinted, 10 ether, "Should not exceed 2x");
    }
}

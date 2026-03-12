// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_CurveAMOStrategy_Shared_Test} from "tests/fork/strategies/CurveAMOStrategy/shared/Shared.t.sol";

contract Fork_Concrete_CurveAMOStrategy_Rebalance_Test is Fork_CurveAMOStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- mintAndAddOTokens
    //////////////////////////////////////////////////////

    function test_mintAndAddOTokens() public {
        // Tilt pool to hard asset (more WETH)
        _tiltPoolToHardAsset(30 ether);

        uint256[] memory balBefore = curvePool.get_balances();
        int256 diffBefore = int256(balBefore[0]) - int256(balBefore[1]);
        assertGt(diffBefore, 0, "Pool should be tilted to hard asset");

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(10 ether);

        uint256[] memory balAfter = curvePool.get_balances();
        int256 diffAfter = int256(balAfter[0]) - int256(balAfter[1]);

        // Pool should be more balanced (diff decreased)
        assertLt(diffAfter, diffBefore);
        assertGe(diffAfter, 0, "Should not overshoot to OToken side");
    }

    function test_mintAndAddOTokens_gaugeBalanceIncreases() public {
        _tiltPoolToHardAsset(30 ether);

        uint256 gaugeBefore = curveGauge.balanceOf(address(curveAMOStrategy));

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(10 ether);

        // LP tokens should be staked in gauge
        assertGt(curveGauge.balanceOf(address(curveAMOStrategy)), gaugeBefore);
    }

    function test_mintAndAddOTokens_oTokenSupplyIncreases() public {
        _tiltPoolToHardAsset(30 ether);

        uint256 supplyBefore = oeth.totalSupply();

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(10 ether);

        // OETH supply should increase by the minted amount
        assertEq(oeth.totalSupply() - supplyBefore, 10 ether);
    }

    function test_mintAndAddOTokens_checkBalanceIncreases() public {
        _tiltPoolToHardAsset(30 ether);

        uint256 balBefore = curveAMOStrategy.checkBalance(address(weth));

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(10 ether);

        // Strategy value should increase (more LP in gauge)
        assertGt(curveAMOStrategy.checkBalance(address(weth)), balBefore);
    }

    function test_mintAndAddOTokens_solvencyMaintained() public {
        _tiltPoolToHardAsset(30 ether);

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(10 ether);

        // Solvency check: totalValue / totalSupply >= 0.998
        uint256 totalValue = oethVault.totalValue();
        uint256 totalSupply = oeth.totalSupply();
        assertGe(totalValue * 1e18 / totalSupply, 0.998 ether);
    }

    function test_mintAndAddOTokens_RevertWhen_poolBalanced() public {
        // Pool is already balanced from setUp, adding OTokens worsens it
        vm.prank(strategist);
        vm.expectRevert("Position balance is worsened");
        curveAMOStrategy.mintAndAddOTokens(10 ether);
    }

    function test_mintAndAddOTokens_RevertWhen_overshoots() public {
        // Slightly tilt pool to hard asset (diffBefore > 0)
        _tiltPoolToHardAsset(5 ether);

        // Add way too many OTokens, overshooting to OToken side (diffAfter < 0)
        vm.prank(strategist);
        vm.expectRevert("Assets overshot peg");
        curveAMOStrategy.mintAndAddOTokens(50 ether);
    }

    function test_mintAndAddOTokens_RevertWhen_poolTiltedToOToken() public {
        // Tilt pool to OToken (diffBefore < 0)
        _tiltPoolToOToken(30 ether);

        // Adding more OTokens makes the OToken tilt worse (diffAfter < diffBefore)
        vm.prank(strategist);
        vm.expectRevert("OTokens balance worse");
        curveAMOStrategy.mintAndAddOTokens(10 ether);
    }

    function test_mintAndAddOTokens_RevertWhen_protocolInsolvent() public {
        // Tilt pool to hard asset so improvePoolBalance passes
        _tiltPoolToHardAsset(30 ether);

        // Inflate OETH supply to make protocol insolvent
        vm.prank(address(oethVault));
        oeth.mint(alice, 1_000_000 ether);

        vm.prank(strategist);
        vm.expectRevert("Protocol insolvent");
        curveAMOStrategy.mintAndAddOTokens(10 ether);
    }

    function test_mintAndAddOTokens_noResidualTokensInStrategy() public {
        _tiltPoolToHardAsset(30 ether);

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(10 ether);

        // No OETH or WETH should remain in the strategy
        assertEq(oeth.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(weth.balanceOf(address(curveAMOStrategy)), 0);
    }

    //////////////////////////////////////////////////////
    /// --- removeAndBurnOTokens
    //////////////////////////////////////////////////////

    function test_removeAndBurnOTokens() public {
        // Tilt pool to OToken (more OETH)
        _tiltPoolToOToken(30 ether);

        // Need LP tokens in the strategy first
        _depositAsVault(10 ether);

        uint256[] memory balBefore = curvePool.get_balances();
        int256 diffBefore = int256(balBefore[0]) - int256(balBefore[1]);
        assertLt(diffBefore, 0, "Pool should be tilted to OToken");

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        vm.prank(strategist);
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);

        uint256[] memory balAfter = curvePool.get_balances();
        int256 diffAfter = int256(balAfter[0]) - int256(balAfter[1]);

        // Pool should be more balanced (diff increased toward 0)
        assertGt(diffAfter, diffBefore);
        assertLe(diffAfter, 0, "Should not overshoot to hard asset side");
    }

    function test_removeAndBurnOTokens_oTokenSupplyDecreases() public {
        _tiltPoolToOToken(30 ether);
        _depositAsVault(10 ether);

        uint256 supplyBefore = oeth.totalSupply();
        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        vm.prank(strategist);
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);

        // OETH supply should decrease (burned OTokens)
        assertLt(oeth.totalSupply(), supplyBefore);
    }

    function test_removeAndBurnOTokens_gaugeBalanceDecreases() public {
        _tiltPoolToOToken(30 ether);
        _depositAsVault(10 ether);

        uint256 gaugeBefore = curveGauge.balanceOf(address(curveAMOStrategy));
        uint256 lpToRemove = gaugeBefore / 4;

        vm.prank(strategist);
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);

        // Gauge balance should decrease by exactly the LP removed
        assertEq(gaugeBefore - curveGauge.balanceOf(address(curveAMOStrategy)), lpToRemove);
    }

    function test_removeAndBurnOTokens_checkBalanceDecreases() public {
        _tiltPoolToOToken(30 ether);
        _depositAsVault(10 ether);

        uint256 balBefore = curveAMOStrategy.checkBalance(address(weth));
        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        vm.prank(strategist);
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);

        // Strategy value should decrease
        assertLt(curveAMOStrategy.checkBalance(address(weth)), balBefore);
    }

    function test_removeAndBurnOTokens_solvencyMaintained() public {
        _tiltPoolToOToken(30 ether);
        _depositAsVault(10 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        vm.prank(strategist);
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);

        uint256 totalValue = oethVault.totalValue();
        uint256 totalSupply = oeth.totalSupply();
        assertGe(totalValue * 1e18 / totalSupply, 0.998 ether);
    }

    function test_removeAndBurnOTokens_RevertWhen_poolTiltedToHardAsset() public {
        // Tilt pool to hard asset (diffBefore > 0)
        _tiltPoolToHardAsset(30 ether);
        _depositAsVault(10 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        // Removing OTokens from hardAsset-tilted pool makes it worse (diffAfter >= diffBefore)
        vm.prank(strategist);
        vm.expectRevert("Assets balance worse");
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }

    function test_removeAndBurnOTokens_RevertWhen_overshoots() public {
        // Slightly tilt pool to OToken (diffBefore slightly < 0)
        _tiltPoolToOToken(3 ether);

        // Deposit to get LP tokens (balanced deposit, so pool stays roughly OToken-tilted)
        _depositAsVault(50 ether);

        // Remove all LP as OTokens — massive one-sided removal overshoots to hardAsset side (diffAfter > 0)
        uint256 allLp = curveGauge.balanceOf(address(curveAMOStrategy));

        vm.prank(strategist);
        vm.expectRevert("OTokens overshot peg");
        curveAMOStrategy.removeAndBurnOTokens(allLp);
    }

    function test_removeAndBurnOTokens_RevertWhen_protocolInsolvent() public {
        // Setup: tilt to OToken and deposit to get LP
        _tiltPoolToOToken(30 ether);
        _depositAsVault(10 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        // Inflate OETH supply to make protocol insolvent
        vm.prank(address(oethVault));
        oeth.mint(alice, 1_000_000 ether);

        vm.prank(strategist);
        vm.expectRevert("Protocol insolvent");
        curveAMOStrategy.removeAndBurnOTokens(lpToRemove);
    }

    //////////////////////////////////////////////////////
    /// --- removeOnlyAssets
    //////////////////////////////////////////////////////

    function test_removeOnlyAssets() public {
        // Tilt pool to hard asset (more WETH)
        _tiltPoolToHardAsset(30 ether);
        _depositAsVault(10 ether);

        uint256[] memory balBefore = curvePool.get_balances();
        int256 diffBefore = int256(balBefore[0]) - int256(balBefore[1]);
        assertGt(diffBefore, 0, "Pool should be tilted to hard asset");

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);

        uint256[] memory balAfter = curvePool.get_balances();
        int256 diffAfter = int256(balAfter[0]) - int256(balAfter[1]);

        // Pool should be more balanced (diff decreased)
        assertLt(diffAfter, diffBefore);
        assertGe(diffAfter, 0, "Should not overshoot to OToken side");
    }

    function test_removeOnlyAssets_transfersToVault() public {
        _tiltPoolToHardAsset(30 ether);
        _depositAsVault(10 ether);

        uint256 vaultWethBefore = weth.balanceOf(address(oethVault));
        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);

        // Vault should have received WETH
        assertGt(weth.balanceOf(address(oethVault)), vaultWethBefore);
    }

    function test_removeOnlyAssets_checkBalanceDecreases() public {
        _tiltPoolToHardAsset(30 ether);
        _depositAsVault(10 ether);

        uint256 balBefore = curveAMOStrategy.checkBalance(address(weth));
        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);

        // Strategy value should decrease (LP burned for hard asset sent to vault)
        assertLt(curveAMOStrategy.checkBalance(address(weth)), balBefore);
    }

    function test_removeOnlyAssets_oTokenSupplyUnchanged() public {
        _tiltPoolToHardAsset(30 ether);
        _depositAsVault(10 ether);

        uint256 supplyBefore = oeth.totalSupply();
        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);

        // OETH supply should be unchanged (no OTokens burned in this operation)
        assertEq(oeth.totalSupply(), supplyBefore);
    }

    function test_removeOnlyAssets_gaugeBalanceDecreases() public {
        _tiltPoolToHardAsset(30 ether);
        _depositAsVault(10 ether);

        uint256 gaugeBefore = curveGauge.balanceOf(address(curveAMOStrategy));
        uint256 lpToRemove = gaugeBefore / 4;

        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);

        // Gauge balance should decrease by exactly the LP removed
        assertEq(gaugeBefore - curveGauge.balanceOf(address(curveAMOStrategy)), lpToRemove);
    }

    function test_removeOnlyAssets_RevertWhen_poolTiltedToOToken() public {
        // Tilt pool to OToken (diffBefore < 0)
        _tiltPoolToOToken(30 ether);
        _depositAsVault(10 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        // Removing hardAsset from OToken-tilted pool makes it worse (diffAfter <= diffBefore)
        vm.prank(strategist);
        vm.expectRevert("OTokens balance worse");
        curveAMOStrategy.removeOnlyAssets(lpToRemove);
    }

    function test_removeOnlyAssets_RevertWhen_overshoots() public {
        // Deposit large amount to get lots of LP tokens
        _depositAsVault(80 ether);

        // Tilt pool slightly to hard asset after deposit (diffBefore slightly > 0)
        _tiltPoolToHardAsset(5 ether);

        // Remove all LP as hardAsset — massive one-sided removal overshoots to OToken side (diffAfter < 0)
        uint256 allLp = curveGauge.balanceOf(address(curveAMOStrategy));

        vm.prank(strategist);
        vm.expectRevert("Assets overshot peg");
        curveAMOStrategy.removeOnlyAssets(allLp);
    }

    function test_removeOnlyAssets_RevertWhen_protocolInsolvent() public {
        // Setup: tilt to hard asset and deposit to get LP
        _tiltPoolToHardAsset(30 ether);
        _depositAsVault(10 ether);

        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;

        // Inflate OETH supply to make protocol insolvent
        vm.prank(address(oethVault));
        oeth.mint(alice, 1_000_000 ether);

        vm.prank(strategist);
        vm.expectRevert("Protocol insolvent");
        curveAMOStrategy.removeOnlyAssets(lpToRemove);
    }

    //////////////////////////////////////////////////////
    /// --- LIFECYCLE
    //////////////////////////////////////////////////////

    function test_lifecycle_deposit_rebalance_withdraw() public {
        // 1. Deposit
        _depositAsVault(50 ether);
        uint256 checkBalAfterDeposit = curveAMOStrategy.checkBalance(address(weth));
        assertGt(checkBalAfterDeposit, 0);

        // 2. Pool gets tilted externally (someone swaps WETH in)
        _tiltPoolToHardAsset(20 ether);

        // 3. Strategist rebalances by adding OTokens
        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(10 ether);

        uint256 checkBalAfterRebalance = curveAMOStrategy.checkBalance(address(weth));
        assertGt(checkBalAfterRebalance, checkBalAfterDeposit);

        // 4. Withdraw all back to vault
        uint256 vaultWethBefore = weth.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        // Strategy should be empty
        assertEq(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(curveAMOStrategy.checkBalance(address(weth)), 0);

        // Vault should have received WETH
        assertGt(weth.balanceOf(address(oethVault)), vaultWethBefore);
    }

    //////////////////////////////////////////////////////
    /// --- LIFECYCLE
    //////////////////////////////////////////////////////

    function test_lifecycle_deposit_removeOnlyAssets_withdraw() public {
        // 1. Deposit into a hardAsset-tilted pool
        _tiltPoolToHardAsset(30 ether);
        _depositAsVault(20 ether);

        // 2. Strategist removes hard assets to rebalance
        uint256 lpToRemove = curveGauge.balanceOf(address(curveAMOStrategy)) / 4;
        uint256 vaultWethBefore = weth.balanceOf(address(oethVault));

        vm.prank(strategist);
        curveAMOStrategy.removeOnlyAssets(lpToRemove);

        assertGt(weth.balanceOf(address(oethVault)), vaultWethBefore);

        // 3. Withdraw remaining
        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        assertEq(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
    }
}

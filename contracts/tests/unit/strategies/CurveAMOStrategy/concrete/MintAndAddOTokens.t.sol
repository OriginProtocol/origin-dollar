// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_CurveAMOStrategy_Shared_Test} from "tests/unit/strategies/CurveAMOStrategy/shared/Shared.t.sol";

// --- Project imports
import {ICurveAMOStrategy} from "contracts/interfaces/strategies/ICurveAMOStrategy.sol";

contract Unit_Concrete_CurveAMOStrategy_MintAndAddOTokens_Test is Unit_CurveAMOStrategy_Shared_Test {
    function test_mintAndAddOTokens_mintsAndAddsToPool() public {
        uint256 oTokenAmount = 10 ether;
        _seedVaultForSolvency(100 ether);
        // Pool tilted to hardAsset so mintAndAddOTokens improves balance
        _setupPoolBalances(200 ether, 100 ether);

        uint256 supplyBefore = oeth.totalSupply();

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(oTokenAmount);

        // OTokens minted
        assertGt(oeth.totalSupply(), supplyBefore);
        // LP tokens staked in gauge
        assertGt(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
    }

    function test_mintAndAddOTokens_improvesBalance_poolTiltedToHardAsset() public {
        _seedVaultForSolvency(100 ether);
        // Pool tilted to hardAsset: more WETH than OETH
        _setupPoolBalances(200 ether, 100 ether);

        // Adding OTokens should improve balance (reduce hardAsset tilt)
        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(50 ether);

        // Should not revert — balance improved
    }

    function test_mintAndAddOTokens_emitsDeposit() public {
        uint256 oTokenAmount = 10 ether;
        _seedVaultForSolvency(100 ether);
        _setupPoolBalances(200 ether, 100 ether);

        vm.expectEmit(true, true, true, true);
        emit ICurveAMOStrategy.Deposit(address(oeth), address(curvePool), oTokenAmount);

        vm.prank(strategist);
        curveAMOStrategy.mintAndAddOTokens(oTokenAmount);
    }

    function test_mintAndAddOTokens_RevertWhen_calledByNonStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist");
        curveAMOStrategy.mintAndAddOTokens(10 ether);
    }

    function test_mintAndAddOTokens_RevertWhen_poolBalanced() public {
        _seedVaultForSolvency(100 ether);
        _setupPoolBalances(100 ether, 100 ether);

        vm.prank(strategist);
        vm.expectRevert("Position balance is worsened");
        curveAMOStrategy.mintAndAddOTokens(10 ether);
    }

    function test_mintAndAddOTokens_RevertWhen_poolTiltedToOToken() public {
        // Seed enough WETH so solvency passes, but the pool balance check fails
        _seedVaultForSolvency(1000 ether);
        // Pool already has too many OTokens (diffBefore < 0)
        _setupPoolBalances(100 ether, 200 ether);

        // Adding more OTokens worsens the OToken tilt
        vm.prank(strategist);
        vm.expectRevert("OTokens balance worse");
        curveAMOStrategy.mintAndAddOTokens(10 ether);
    }

    function test_mintAndAddOTokens_RevertWhen_overshoots() public {
        _seedVaultForSolvency(1000 ether);
        // Pool slightly tilted to hardAsset (diffBefore > 0)
        _setupPoolBalances(110 ether, 100 ether);

        // Adding way too many OTokens will overshoot to OToken side (diffAfter < 0)
        // diffBefore > 0, diffAfter < 0 → "Assets overshot peg"
        vm.prank(strategist);
        vm.expectRevert("Assets overshot peg");
        curveAMOStrategy.mintAndAddOTokens(50 ether);
    }

    function test_mintAndAddOTokens_RevertWhen_protocolInsolvent() public {
        // Inflate OETH supply to make protocol insolvent after minting
        vm.prank(address(oethVault));
        oeth.mint(alice, 1000 ether);

        // Pool tilted to hardAsset so improvePoolBalance passes
        _setupPoolBalances(200 ether, 100 ether);

        vm.prank(strategist);
        vm.expectRevert("Protocol insolvent");
        curveAMOStrategy.mintAndAddOTokens(10 ether);
    }

    function test_mintAndAddOTokens_RevertWhen_minLpAmountError() public {
        _seedVaultForSolvency(1000 ether);
        _setupPoolBalances(200 ether, 100 ether);

        // Set high slippage on the mock pool so LP minted < minMintAmount
        curvePool.setSlippageBps(500); // 5% slippage on pool

        // With 1% max slippage tolerance, 5% actual slippage should fail
        vm.prank(strategist);
        vm.expectRevert("Min LP amount error");
        curveAMOStrategy.mintAndAddOTokens(10 ether);
    }
}

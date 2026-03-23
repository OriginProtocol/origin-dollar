// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_CurveAMOStrategy_Shared_Test} from "tests/fork/mainnet/strategies/CurveAMOStrategy/shared/Shared.t.sol";

contract Fork_Concrete_CurveAMOStrategy_Deposit_Test is Fork_CurveAMOStrategy_Shared_Test {
    function test_deposit() public {
        uint256 amount = 10 ether;

        uint256 gaugeBefore = curveGauge.balanceOf(address(curveAMOStrategy));
        uint256[] memory poolBalBefore = curvePool.get_balances();

        _depositAsVault(amount);

        // LP tokens should be staked in gauge
        assertGt(curveGauge.balanceOf(address(curveAMOStrategy)), gaugeBefore);
        // Pool balances should have changed
        uint256[] memory poolBalAfter = curvePool.get_balances();
        assertGt(poolBalAfter[0], poolBalBefore[0]); // WETH increased
        assertGt(poolBalAfter[1], poolBalBefore[1]); // OETH increased
    }

    function test_deposit_mintsCorrectOTokenAmount() public {
        uint256 amount = 10 ether;

        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethMinted = oeth.totalSupply() - oethSupplyBefore;

        // In a balanced pool, OETH minted should be approximately equal to WETH deposited
        assertApproxEqRel(oethMinted, amount, 2e16); // 2% tolerance
    }

    function test_deposit_mintsMoreOTokens_poolTiltedToHardAsset() public {
        // Tilt pool to hard asset (more WETH)
        _tiltPoolToHardAsset(30 ether);

        uint256 amount = 10 ether;
        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethMinted = oeth.totalSupply() - oethSupplyBefore;

        // More OETH should be minted than WETH deposited to rebalance
        assertGt(oethMinted, amount);
    }

    function test_deposit_checkBalanceReflectsDeposit() public {
        uint256 amount = 10 ether;

        uint256 balBefore = curveAMOStrategy.checkBalance(address(weth));
        _depositAsVault(amount);
        uint256 balAfter = curveAMOStrategy.checkBalance(address(weth));

        // checkBalance returns LP value (WETH + OETH sides). Depositing 10 WETH
        // also mints ~10 OETH, so the LP value increase is ~2x the WETH deposited.
        uint256 balIncrease = balAfter - balBefore;
        assertApproxEqRel(balIncrease, amount * 2, 2e16); // 2% tolerance
    }

    function test_deposit_virtualPriceDoesNotDecrease() public {
        uint256 vpBefore = curvePool.get_virtual_price();
        _depositAsVault(10 ether);
        uint256 vpAfter = curvePool.get_virtual_price();

        assertGe(vpAfter, vpBefore);
    }

    function test_deposit_mintsMinimumOTokens_poolTiltedToOToken() public {
        // Tilt pool to OToken (more OETH)
        _tiltPoolToOToken(30 ether);

        uint256 amount = 10 ether;
        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethMinted = oeth.totalSupply() - oethSupplyBefore;

        // Pool already has excess OETH, but deposit still mints at minimum 1x
        assertApproxEqRel(oethMinted, amount, 2e16); // ~1x, 2% tolerance
    }

    function test_deposit_capsOTokenMintAt2x() public {
        // Extreme tilt: pool has lots of WETH, very little OETH
        _tiltPoolToHardAsset(80 ether);

        uint256 amount = 5 ether;
        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethMinted = oeth.totalSupply() - oethSupplyBefore;

        // Capped at 2x
        assertApproxEqRel(oethMinted, amount * 2, 1e16); // 1% tolerance
    }

    function test_deposit_multipleSequentialDeposits() public {
        _depositAsVault(10 ether);
        uint256 gaugeAfterFirst = curveGauge.balanceOf(address(curveAMOStrategy));
        uint256 balAfterFirst = curveAMOStrategy.checkBalance(address(weth));

        _depositAsVault(20 ether);
        uint256 gaugeAfterSecond = curveGauge.balanceOf(address(curveAMOStrategy));
        uint256 balAfterSecond = curveAMOStrategy.checkBalance(address(weth));

        // Gauge and checkBalance should increase with each deposit
        assertGt(gaugeAfterSecond, gaugeAfterFirst);
        assertGt(balAfterSecond, balAfterFirst);
    }

    function test_depositAll_noOpWhenEmpty() public {
        uint256 gaugeBefore = curveGauge.balanceOf(address(curveAMOStrategy));
        uint256 supplyBefore = oeth.totalSupply();

        vm.prank(address(oethVault));
        curveAMOStrategy.depositAll();

        // Nothing should change
        assertEq(curveGauge.balanceOf(address(curveAMOStrategy)), gaugeBefore);
        assertEq(oeth.totalSupply(), supplyBefore);
    }

    function test_deposit_noResidualTokensInStrategy() public {
        _depositAsVault(10 ether);

        // No WETH or OETH should remain in the strategy after deposit
        assertEq(weth.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(oeth.balanceOf(address(curveAMOStrategy)), 0);
    }

    function test_deposit_heavilyUnbalancedWithOToken() public {
        _depositAsVault(10 ether);

        // Heavily tilt pool to OToken (10x deposit)
        _tiltPoolToOToken(100 ether);

        uint256 gaugeBefore = curveGauge.balanceOf(address(curveAMOStrategy));
        _depositAsVault(10 ether);

        // Should still work and increase gauge balance
        assertGt(curveGauge.balanceOf(address(curveAMOStrategy)), gaugeBefore);
        assertEq(weth.balanceOf(address(curveAMOStrategy)), 0);
    }

    function test_deposit_heavilyUnbalancedWithWeth() public {
        _depositAsVault(10 ether);

        // Heavily tilt pool to hard asset (100x deposit)
        _tiltPoolToHardAsset(100 ether);

        uint256 gaugeBefore = curveGauge.balanceOf(address(curveAMOStrategy));
        _depositAsVault(10 ether);

        // Should still work and increase gauge balance
        assertGt(curveGauge.balanceOf(address(curveAMOStrategy)), gaugeBefore);
        assertEq(weth.balanceOf(address(curveAMOStrategy)), 0);
    }

    function test_deposit_RevertWhen_protocolInsolvent() public {
        // Inflate OETH supply to make protocol insolvent after deposit
        vm.prank(address(oethVault));
        oeth.mint(alice, 1_000_000 ether);

        deal(address(weth), address(curveAMOStrategy), 1 ether);

        vm.prank(address(oethVault));
        vm.expectRevert("Protocol insolvent");
        curveAMOStrategy.deposit(address(weth), 1 ether);
    }

    function test_depositAll() public {
        uint256 amount = 10 ether;
        deal(address(weth), address(curveAMOStrategy), amount);

        uint256 gaugeBefore = curveGauge.balanceOf(address(curveAMOStrategy));

        vm.prank(address(oethVault));
        curveAMOStrategy.depositAll();

        assertGt(curveGauge.balanceOf(address(curveAMOStrategy)), gaugeBefore);
        assertEq(weth.balanceOf(address(curveAMOStrategy)), 0);
    }

    //////////////////////////////////////////////////////
    /// --- checkBalance
    //////////////////////////////////////////////////////

    function test_checkBalance_zeroWhenNothingDeposited() public view {
        assertEq(curveAMOStrategy.checkBalance(address(weth)), 0);
    }

    function test_checkBalance_includesLooseWethInStrategy() public {
        // Deposit to have gauge balance
        _depositAsVault(10 ether);

        uint256 balWithGaugeOnly = curveAMOStrategy.checkBalance(address(weth));

        // Deal loose WETH to the strategy
        deal(address(weth), address(curveAMOStrategy), 5 ether);

        uint256 balWithLooseWeth = curveAMOStrategy.checkBalance(address(weth));

        // checkBalance should include both gauge LP value AND loose WETH
        assertApproxEqAbs(balWithLooseWeth - balWithGaugeOnly, 5 ether, 1);
    }
}

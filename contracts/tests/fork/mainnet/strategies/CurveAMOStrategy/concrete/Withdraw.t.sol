// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Fork_CurveAMOStrategy_Shared_Test} from "tests/fork/mainnet/strategies/CurveAMOStrategy/shared/Shared.t.sol";

contract Fork_Concrete_CurveAMOStrategy_Withdraw_Test is Fork_CurveAMOStrategy_Shared_Test {
    function test_withdraw() public {
        // Deposit first
        _depositAsVault(10 ether);

        uint256 vaultWethBefore = weth.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        curveAMOStrategy.withdraw(address(oethVault), address(weth), 5 ether);

        // Vault should receive exactly 5 WETH
        assertEq(weth.balanceOf(address(oethVault)) - vaultWethBefore, 5 ether);
    }

    function test_withdraw_burnsOTokens() public {
        _depositAsVault(10 ether);

        uint256 supplyBefore = oeth.totalSupply();

        vm.prank(address(oethVault));
        curveAMOStrategy.withdraw(address(oethVault), address(weth), 5 ether);

        // OETH total supply should decrease after withdrawal
        assertLt(oeth.totalSupply(), supplyBefore);
    }

    function test_withdraw_gaugeBalanceDecreases() public {
        _depositAsVault(10 ether);

        uint256 gaugeBefore = curveGauge.balanceOf(address(curveAMOStrategy));

        vm.prank(address(oethVault));
        curveAMOStrategy.withdraw(address(oethVault), address(weth), 5 ether);

        // Gauge balance should decrease by the LP tokens burned
        assertLt(curveGauge.balanceOf(address(curveAMOStrategy)), gaugeBefore);
    }

    function test_withdraw_partialWithdrawal() public {
        _depositAsVault(10 ether);

        uint256 balBefore = curveAMOStrategy.checkBalance(address(weth));

        vm.prank(address(oethVault));
        curveAMOStrategy.withdraw(address(oethVault), address(weth), 5 ether);

        uint256 balAfter = curveAMOStrategy.checkBalance(address(weth));

        // checkBalance reflects total LP value. Withdrawing 5 WETH does a proportional
        // removal that burns LP covering both WETH and OETH sides, so the balance
        // decrease is ~2x the WETH withdrawn.
        uint256 balDecrease = balBefore - balAfter;
        assertApproxEqRel(balDecrease, 10 ether, 5e16); // ~10 ETH of LP value removed, 5% tolerance
    }

    function test_withdraw_nearFullAmount() public {
        _depositAsVault(10 ether);

        uint256 vaultWethBefore = weth.balanceOf(address(oethVault));

        // Withdraw nearly full amount (calcTokenToBurn adds +1 to LP calculation,
        // so withdrawing the exact deposit amount may require slightly more LP than available)
        uint256 withdrawAmount = 9.99 ether;
        vm.prank(address(oethVault));
        curveAMOStrategy.withdraw(address(oethVault), address(weth), withdrawAmount);

        // Vault should receive exactly the requested amount
        assertEq(weth.balanceOf(address(oethVault)) - vaultWethBefore, withdrawAmount);
        // Almost no LP should remain in gauge
        assertLt(curveGauge.balanceOf(address(curveAMOStrategy)), 0.1 ether);
    }

    function test_withdraw_fromTiltedPool() public {
        _depositAsVault(10 ether);

        // Tilt pool after deposit
        _tiltPoolToHardAsset(20 ether);

        uint256 vaultWethBefore = weth.balanceOf(address(oethVault));

        // Withdraw uses calcTokenToBurn which depends on real pool ratios
        vm.prank(address(oethVault));
        curveAMOStrategy.withdraw(address(oethVault), address(weth), 5 ether);

        // Should still get exactly 5 WETH (balanced removal guarantees this)
        assertEq(weth.balanceOf(address(oethVault)) - vaultWethBefore, 5 ether);
    }

    function test_withdrawAll_burnsOTokens() public {
        _depositAsVault(10 ether);

        uint256 supplyBefore = oeth.totalSupply();

        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        // OETH supply should decrease (OTokens from proportional removal burned)
        assertLt(oeth.totalSupply(), supplyBefore);
    }

    function test_withdrawAll_noResidualTokensInStrategy() public {
        _depositAsVault(10 ether);

        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        // No WETH, OETH, or LP tokens should remain in the strategy
        assertEq(weth.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(oeth.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(curvePool.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
    }

    function test_withdrawAll_calledByGovernor() public {
        _depositAsVault(10 ether);

        uint256 vaultWethBefore = weth.balanceOf(address(oethVault));

        vm.prank(governor);
        curveAMOStrategy.withdrawAll();

        // Governor can call withdrawAll, same behavior
        assertEq(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
        assertGt(weth.balanceOf(address(oethVault)), vaultWethBefore);
    }

    function test_withdrawAll_fromTiltedPool() public {
        _depositAsVault(10 ether);

        // Tilt pool after deposit
        _tiltPoolToOToken(20 ether);

        uint256 vaultWethBefore = weth.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        // Should still withdraw without revert (proportional removal)
        assertEq(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
        assertGt(weth.balanceOf(address(oethVault)), vaultWethBefore);
    }

    function test_withdraw_noResidualTokensInStrategy() public {
        _depositAsVault(10 ether);

        vm.prank(address(oethVault));
        curveAMOStrategy.withdraw(address(oethVault), address(weth), 5 ether);

        // No OETH should remain; WETH may have up to 1 wei rounding dust
        assertEq(oeth.balanceOf(address(curveAMOStrategy)), 0);
        assertLe(weth.balanceOf(address(curveAMOStrategy)), 1);
    }

    function test_withdrawAll_vaultReceivesApproxHalfGaugeBalance() public {
        _depositAsVault(10 ether);

        uint256 vaultWethBefore = weth.balanceOf(address(oethVault));
        uint256 gaugeBalance = curveGauge.balanceOf(address(curveAMOStrategy));

        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        // Vault should receive approximately gaugeBalance/2 worth of WETH
        // (proportional removal of balanced pool returns ~half as WETH, half as OETH which is burned)
        uint256 wethReceived = weth.balanceOf(address(oethVault)) - vaultWethBefore;
        assertApproxEqRel(wethReceived, gaugeBalance / 2, 5e16); // 5% tolerance
    }

    function test_withdrawAll_heavilyUnbalancedWithOToken() public {
        _depositAsVault(10 ether);

        // Heavily tilt pool to OToken
        _tiltPoolToOToken(100 ether);

        uint256 vaultWethBefore = weth.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        // Should fully withdraw without revert
        assertEq(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(oeth.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(weth.balanceOf(address(curveAMOStrategy)), 0);
        assertGt(weth.balanceOf(address(oethVault)), vaultWethBefore);
    }

    function test_withdrawAll_heavilyUnbalancedWithWeth() public {
        _depositAsVault(10 ether);

        // Heavily tilt pool to hard asset
        _tiltPoolToHardAsset(20 ether);

        uint256 vaultWethBefore = weth.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        // Should fully withdraw without revert
        assertEq(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(oeth.balanceOf(address(curveAMOStrategy)), 0);
        assertEq(weth.balanceOf(address(curveAMOStrategy)), 0);
        assertGt(weth.balanceOf(address(oethVault)), vaultWethBefore);
    }

    function test_withdraw_RevertWhen_insufficientLPTokens() public {
        // Deposit only 5 WETH
        _depositAsVault(5 ether);

        // Try to withdraw more than deposited
        vm.prank(address(oethVault));
        vm.expectRevert("Insufficient LP tokens");
        curveAMOStrategy.withdraw(address(oethVault), address(weth), 100 ether);
    }

    function test_withdraw_RevertWhen_protocolInsolvent() public {
        // Deposit while solvent
        _depositAsVault(10 ether);

        // Inflate OETH supply to make protocol insolvent
        vm.prank(address(oethVault));
        oeth.mint(alice, 1_000_000 ether);

        vm.prank(address(oethVault));
        vm.expectRevert("Protocol insolvent");
        curveAMOStrategy.withdraw(address(oethVault), address(weth), 5 ether);
    }

    function test_withdrawAll() public {
        _depositAsVault(10 ether);

        assertGt(curveGauge.balanceOf(address(curveAMOStrategy)), 0);

        uint256 vaultWethBefore = weth.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        // Gauge should be empty
        assertEq(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
        // Vault should have received WETH
        assertGt(weth.balanceOf(address(oethVault)), vaultWethBefore);
    }

    function test_withdrawAll_noOpWhenEmpty() public {
        // No deposits made, withdrawAll should not revert
        vm.prank(address(oethVault));
        curveAMOStrategy.withdrawAll();

        assertEq(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Smoke_BaseBridgeHelperModule_Shared_Test
} from "tests/smoke/base/automation/BaseBridgeHelperModule/shared/Shared.t.sol";
import {Base} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_BaseBridgeHelperModule_Test is Smoke_BaseBridgeHelperModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW TESTS
    //////////////////////////////////////////////////////

    function test_vault() public view {
        assertEq(address(baseBridgeHelperModule.vault()), Base.OETHBaseVaultProxy);
    }

    function test_weth() public view {
        assertEq(address(baseBridgeHelperModule.weth()), Base.WETH);
    }

    function test_oethb() public view {
        assertEq(address(baseBridgeHelperModule.oethb()), Base.OETHBaseProxy);
    }

    function test_bridgedWOETH() public view {
        assertEq(address(baseBridgeHelperModule.bridgedWOETH()), Base.BridgedWOETH);
    }

    function test_safeContract() public view {
        assertNotEq(address(baseBridgeHelperModule.safeContract()), address(0));
    }

    function test_CCIP_ROUTER() public view {
        assertEq(address(baseBridgeHelperModule.CCIP_ROUTER()), Base.CCIPRouter);
    }

    function test_bridgedWOETHStrategy() public view {
        assertEq(address(baseBridgeHelperModule.bridgedWOETHStrategy()), Base.BridgedWOETHStrategyProxy);
    }

    //////////////////////////////////////////////////////
    /// --- MUTATIVE TESTS
    //////////////////////////////////////////////////////

    function test_depositWOETH() public {
        uint256 woethAmount = 1 ether;
        deal(address(bridgedWoeth), safe, woethAmount);

        uint256 safeWoethBefore = bridgedWoeth.balanceOf(safe);
        uint256 strategyWoethBefore = bridgedWoeth.balanceOf(address(bridgedWOETHStrategy));

        vm.prank(operator);
        baseBridgeHelperModule.depositWOETH(woethAmount, false);

        assertEq(bridgedWoeth.balanceOf(safe), safeWoethBefore - woethAmount, "Safe wOETH should decrease");
        assertEq(
            bridgedWoeth.balanceOf(address(bridgedWOETHStrategy)),
            strategyWoethBefore + woethAmount,
            "Strategy wOETH should increase"
        );
    }

    function test_depositWOETHAndClaimWithdrawal() public {
        // Fund vault with WETH liquidity
        _fundWithWETH(nick, 10_000 ether);
        vm.startPrank(nick);
        weth.approve(address(vault), 10_000 ether);
        vault.mint(10_000 ether);
        vm.stopPrank();

        // Ensure withdrawal claim delay is set
        uint256 delayPeriod = vault.withdrawalClaimDelay();
        if (delayPeriod == 0) {
            vm.prank(baseGovernor);
            vault.setWithdrawalClaimDelay(10 minutes);
            delayPeriod = 10 minutes;
        }

        uint256 woethAmount = 1 ether;
        deal(address(bridgedWoeth), safe, woethAmount);

        uint256 expectedWETH = bridgedWOETHStrategy.getBridgedWOETHValue(woethAmount);
        uint256 nextWithdrawalIndex = uint256(vault.withdrawalQueueMetadata().nextWithdrawalIndex);

        uint256 safeWethBefore = weth.balanceOf(safe);

        vm.prank(operator);
        baseBridgeHelperModule.depositWOETH(woethAmount, true);

        skip(delayPeriod + 1);

        vm.prank(operator);
        baseBridgeHelperModule.claimWithdrawal(nextWithdrawalIndex);

        assertApproxEqRel(
            weth.balanceOf(safe), safeWethBefore + expectedWETH, 0.01e18, "Safe WETH should increase after claim"
        );
    }

    function test_depositWETHAndRedeemWOETH() public {
        uint256 wethAmount = 1 ether;
        _fundWithWETH(safe, wethAmount);

        uint256 safeWethBefore = weth.balanceOf(safe);
        uint256 safeWoethBefore = bridgedWoeth.balanceOf(safe);

        vm.prank(operator);
        baseBridgeHelperModule.depositWETHAndRedeemWOETH(wethAmount);

        assertEq(weth.balanceOf(safe), safeWethBefore - wethAmount, "Safe WETH should decrease");
        assertGt(bridgedWoeth.balanceOf(safe), safeWoethBefore, "Safe wOETH should increase");
    }

    function test_bridgeWETHToEthereum() public {
        uint256 wethAmount = 1 ether;
        _fundWithWETH(safe, wethAmount);
        vm.deal(safe, 1 ether); // for CCIP gas fee

        uint256 safeWethBefore = weth.balanceOf(safe);

        vm.prank(operator);
        baseBridgeHelperModule.bridgeWETHToEthereum(wethAmount);

        assertLt(weth.balanceOf(safe), safeWethBefore, "Safe WETH should decrease after bridge");
    }

    function test_bridgeWOETHToEthereum() public {
        uint256 woethAmount = 1 ether;
        deal(address(bridgedWoeth), safe, woethAmount);
        vm.deal(safe, 1 ether); // for CCIP gas fee

        uint256 safeWoethBefore = bridgedWoeth.balanceOf(safe);

        vm.prank(operator);
        baseBridgeHelperModule.bridgeWOETHToEthereum(woethAmount);

        assertLt(bridgedWoeth.balanceOf(safe), safeWoethBefore, "Safe wOETH should decrease after bridge");
    }

    function test_depositWETHAndBridgeWOETH() public {
        uint256 wethAmount = 1 ether;
        _fundWithWETH(safe, wethAmount);
        vm.deal(safe, 1 ether); // for CCIP gas fee

        uint256 safeWethBefore = weth.balanceOf(safe);
        uint256 safeWoethBefore = bridgedWoeth.balanceOf(safe);

        vm.prank(operator);
        baseBridgeHelperModule.depositWETHAndBridgeWOETH(wethAmount);

        assertLt(weth.balanceOf(safe), safeWethBefore, "Safe WETH should decrease");
        assertEq(bridgedWoeth.balanceOf(safe), safeWoethBefore, "Safe wOETH should be unchanged");
    }

    function test_claimAndBridgeWETH() public {
        // Fund vault with WETH liquidity
        _fundWithWETH(nick, 10_000 ether);
        vm.startPrank(nick);
        weth.approve(address(vault), 10_000 ether);
        vault.mint(10_000 ether);
        vm.stopPrank();

        // Ensure withdrawal claim delay is set
        uint256 delayPeriod = vault.withdrawalClaimDelay();
        if (delayPeriod == 0) {
            vm.prank(baseGovernor);
            vault.setWithdrawalClaimDelay(10 minutes);
            delayPeriod = 10 minutes;
        }

        uint256 woethAmount = 1 ether;
        deal(address(bridgedWoeth), safe, woethAmount);
        vm.deal(safe, 1 ether); // for CCIP gas fee

        uint256 nextWithdrawalIndex = uint256(vault.withdrawalQueueMetadata().nextWithdrawalIndex);

        vm.prank(operator);
        baseBridgeHelperModule.depositWOETH(woethAmount, true);

        skip(delayPeriod + 1);

        uint256 safeWethBefore = weth.balanceOf(safe);

        vm.prank(operator);
        baseBridgeHelperModule.claimAndBridgeWETH(nextWithdrawalIndex);

        // WETH was claimed then immediately bridged to Ethereum, so safe WETH should not increase
        assertLe(weth.balanceOf(safe), safeWethBefore, "Safe WETH should not increase after claimAndBridge");
    }
}

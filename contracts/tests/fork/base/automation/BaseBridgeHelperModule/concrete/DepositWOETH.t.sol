// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Fork_BaseBridgeHelperModule_Shared_Test
} from "tests/fork/base/automation/BaseBridgeHelperModule/shared/Shared.t.sol";

contract Fork_Concrete_BaseBridgeHelperModule_DepositWOETH_Test is Fork_BaseBridgeHelperModule_Shared_Test {
    function test_depositWOETHAndAsyncWithdraw() public {
        // Make sure Vault has some WETH for withdrawal claims
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

        // Update oracle price and rebase
        bridgedWOETHStrategy.updateWOETHOraclePrice();
        vault.rebase();

        uint256 woethAmount = 1 ether;
        uint256 expectedWETH = bridgedWOETHStrategy.getBridgedWOETHValue(woethAmount);

        // Mint wOETH to Safe
        _mintBridgedWOETH(safeSigner, woethAmount);

        uint256 wethBalanceBefore = weth.balanceOf(safeSigner);
        uint256 woethBalanceBefore = bridgedWoeth.balanceOf(safeSigner);
        uint256 woethStrategyBalanceBefore = bridgedWoeth.balanceOf(address(bridgedWOETHStrategy));
        uint256 woethStrategyValueBefore = bridgedWOETHStrategy.checkBalance(address(weth));

        // Get next withdrawal index
        uint256 nextWithdrawalIndex = uint256(vault.withdrawalQueueMetadata().nextWithdrawalIndex);

        // Deposit wOETH and request async withdrawal
        vm.prank(safeSigner);
        baseBridgeHelperModule.depositWOETH(woethAmount, true);

        // wOETH should be transferred to strategy
        assertEq(
            bridgedWoeth.balanceOf(safeSigner), woethBalanceBefore - woethAmount, "Safe wOETH balance should decrease"
        );
        assertEq(
            bridgedWoeth.balanceOf(address(bridgedWOETHStrategy)),
            woethStrategyBalanceBefore + woethAmount,
            "Strategy wOETH balance should increase"
        );
        assertApproxEqRel(
            bridgedWOETHStrategy.checkBalance(address(weth)),
            woethStrategyValueBefore + expectedWETH,
            0.01e18,
            "Strategy value should increase"
        );

        // WETH shouldn't have changed yet (withdrawal is pending)
        assertEq(weth.balanceOf(safeSigner), wethBalanceBefore, "WETH should not change before claim");

        // Advance time past the claim delay
        skip(delayPeriod + 1);

        // Claim the withdrawal
        vm.prank(safeSigner);
        baseBridgeHelperModule.claimWithdrawal(nextWithdrawalIndex);

        // WETH should have increased
        uint256 wethBalanceAfter = weth.balanceOf(safeSigner);
        assertApproxEqRel(
            wethBalanceAfter, wethBalanceBefore + expectedWETH, 0.01e18, "WETH balance should increase after claim"
        );
    }
}

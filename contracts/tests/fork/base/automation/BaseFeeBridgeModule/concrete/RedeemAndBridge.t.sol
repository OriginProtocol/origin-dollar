// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Fork_Base_BaseFeeBridgeModule_Shared_Test
} from "tests/fork/base/automation/BaseFeeBridgeModule/shared/Shared.t.sol";

contract Fork_Concrete_BaseFeeBridgeModule_RedeemAndBridge_Test is Fork_Base_BaseFeeBridgeModule_Shared_Test {
    uint256 internal constant AMOUNT = 2 ether;

    function setUp() public override {
        super.setUp();
        _fundSafe(AMOUNT);
    }

    /// @dev Runs against the live vault queue and the live CCIP router, so it proves the Base ->
    ///      Ethereum lane accepts WETH with a token-only message addressed to the FeeSplitter.
    function test_requestThenClaimAndBridge() public {
        uint256 oethbBefore = oethb.balanceOf(safe);
        uint256 wethBefore = weth.balanceOf(safe);

        vm.prank(operator);
        module.requestWithdrawal(AMOUNT);

        assertApproxEqAbs(oethbBefore - oethb.balanceOf(safe), AMOUNT, 1, "OETHb not burned");
        assertTrue(module.hasPendingRequest());
        assertEq(vault.withdrawalRequests(module.pendingRequestId()).withdrawer, safe);

        skip(vault.withdrawalClaimDelay());
        // Most of the vault's idle WETH is reserved for earlier claimable requests, so the queue
        // may not cover this one on the live fork. Top the vault up as a mint would.
        deal(address(weth), address(vault), weth.balanceOf(address(vault)) + AMOUNT);
        uint256 ethBefore = safe.balance;
        uint256 fee = module.bridgeFee(AMOUNT);

        vm.prank(operator);
        module.claimAndBridge();

        assertFalse(module.hasPendingRequest(), "Pending state not cleared");
        assertEq(weth.balanceOf(safe), wethBefore, "WETH left on Safe");
        assertEq(ethBefore - safe.balance, fee, "CCIP fee not as quoted");
    }

    function test_claimAndBridge_revertsBeforeDelay() public {
        vm.prank(operator);
        module.requestWithdrawal(AMOUNT);

        vm.prank(operator);
        vm.expectRevert("Withdrawal claim failed");
        module.claimAndBridge();
    }

    function test_requestWithdrawal_revertsWhenPending() public {
        vm.prank(operator);
        module.requestWithdrawal(AMOUNT / 2);

        vm.prank(operator);
        vm.expectRevert("Request pending");
        module.requestWithdrawal(AMOUNT / 2);
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Fork_Base_BaseFeeBridgeModule_Shared_Test
} from "tests/fork/base/automation/BaseFeeBridgeModule/shared/Shared.t.sol";

contract Fork_Concrete_BaseFeeBridgeModule_SwapAndBridge_Test is Fork_Base_BaseFeeBridgeModule_Shared_Test {
    uint256 internal constant AMOUNT = 2 ether;

    function setUp() public override {
        super.setUp();
        _fundSafe(AMOUNT);
    }

    /// @dev Runs against the live Curve pool and the live CCIP router, so it proves the Base ->
    ///      Ethereum lane accepts WETH with a token-only message addressed to the FeeSplitter.
    function test_swapAndBridge_sellsOnCurveAndSendsOverCcip() public {
        uint256 oethbBefore = oethb.balanceOf(safe);
        uint256 wethBefore = weth.balanceOf(safe);
        uint256 ethBefore = safe.balance;
        uint256 quote = _quote(AMOUNT);

        vm.prank(operator);
        module.swapAndBridge(AMOUNT, (quote * 9990) / 1e4);

        assertApproxEqAbs(oethbBefore - oethb.balanceOf(safe), AMOUNT, 1, "OETHb not sold");
        assertEq(weth.balanceOf(safe), wethBefore, "WETH left on Safe");
        assertEq(ethBefore - safe.balance, module.bridgeFee(quote), "CCIP fee not as quoted");
    }

    function test_swapAndBridge_quoteIsWithinFloor() public view {
        // Guards the deploy-time default: if the pool drifts past the floor, this fails before
        // the Talos action starts reverting in production.
        assertGe(_quote(AMOUNT), (AMOUNT * (1e4 - module.maxSlippageBps())) / 1e4);
    }

    function test_swapAndBridge_revertsWhenMinOutAboveQuote() public {
        uint256 quote = _quote(AMOUNT);

        vm.prank(operator);
        vm.expectRevert("Swap failed");
        module.swapAndBridge(AMOUNT, quote + 1);
    }
}

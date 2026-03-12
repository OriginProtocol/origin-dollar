// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_AerodromeAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Base as BaseAddresses} from "tests/utils/Addresses.sol";
import {AerodromeAMOStrategy} from "contracts/strategies/aerodrome/AerodromeAMOStrategy.sol";

contract Fork_AerodromeAMOStrategy_Rebalance_Test is Fork_AerodromeAMOStrategy_Shared_Test {
    function test_rebalance_emitsPoolRebalanced() public {
        _depositAsVault(5 ether);

        vm.prank(strategist);
        vm.expectEmit(false, false, false, false, address(aerodromeAMOStrategy));
        emit AerodromeAMOStrategy.PoolRebalanced(0);
        aerodromeAMOStrategy.rebalance(0, true, 0);
    }

    function test_rebalance_addsLiquidityWithNoSwap() public {
        uint256 balanceBefore = aerodromeAMOStrategy.checkBalance(BaseAddresses.WETH);

        _depositAsVault(6 ether);

        // Just add liquidity, don't move the active trading position
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);

        uint256 balanceAfter = aerodromeAMOStrategy.checkBalance(BaseAddresses.WETH);
        assertGt(balanceAfter, balanceBefore, "checkBalance should increase");

        _verifyEndConditions(true);
    }

    function test_rebalance_multipleRebalances() public {
        // First deposit + rebalance
        _depositAsVault(5 ether);
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);
        _verifyEndConditions(true);

        // Second deposit + rebalance
        _depositAsVault(5 ether);
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);
        _verifyEndConditions(true);
    }

    function test_rebalance_lpStakedInGaugeAfter() public {
        _depositAsVault(5 ether);

        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);

        _assertLpStakedInGauge();
    }

    function test_rebalance_RevertWhen_poolRebalanceOutOfBounds() public {
        // Set very narrow allowed interval that won't match current pool state
        vm.prank(governor);
        aerodromeAMOStrategy.setAllowedPoolWethShareInterval(0.90 ether, 0.94 ether);

        _depositAsVault(5 ether);

        vm.prank(strategist);
        // Reverts with PoolRebalanceOutOfBounds(currentPoolWETHShare, allowedWethShareStart, allowedWethShareEnd)
        vm.expectRevert();
        aerodromeAMOStrategy.rebalance(0, true, 0);
    }

    function test_rebalance_RevertWhen_protocolInsolvent() public {
        // Create large OETHb supply via mint to make protocol insolvent
        // First do a large deposit + withdrawAll to inflate supply
        _depositAsVault(100 ether);
        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdrawAll();

        // Re-deposit small amount so there's a position
        _depositAsVault(1 ether);

        // Transfer most WETH out of vault to make it insolvent
        uint256 vaultWeth = IERC20(BaseAddresses.WETH).balanceOf(address(oethBaseVault));
        vm.prank(address(oethBaseVault));
        IERC20(BaseAddresses.WETH).transfer(DEAD_ADDRESS, vaultWeth);

        // Small WETH for swap + add liquidity
        deal(BaseAddresses.WETH, address(aerodromeAMOStrategy), 0.001 ether);

        vm.prank(strategist);
        vm.expectRevert("Protocol insolvent");
        aerodromeAMOStrategy.rebalance(0.0001 ether, true, 0);
    }

    function test_rebalance_checkBalanceWithTolerance() public {
        uint256 balanceBefore = aerodromeAMOStrategy.checkBalance(BaseAddresses.WETH);

        _depositAsVault(6 ether);
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);

        uint256 balanceAfter = aerodromeAMOStrategy.checkBalance(BaseAddresses.WETH);

        // checkBalance reports total position value (WETH + OETHb valued at 1:1).
        // The increase should be significantly more than the raw WETH deposit due to OETHb minting.
        assertGt(balanceAfter - balanceBefore, 6 ether, "checkBalance should increase by more than deposit");
        // But shouldn't be unreasonably large
        assertLt(balanceAfter - balanceBefore, 6 ether * 20, "checkBalance increase should be reasonable");

        _verifyEndConditions(true);
    }

    function test_rebalance_lpStaysStagedThroughLifecycle() public {
        // Deposit + rebalance
        _depositAsVault(5 ether);
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);
        _verifyEndConditions(true);

        // Second deposit + rebalance
        _depositAsVault(5 ether);
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);
        _verifyEndConditions(true);

        // Withdraw
        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), BaseAddresses.WETH, 1 ether);
        _verifyEndConditions(true);

        // Third deposit + rebalance
        _depositAsVault(5 ether);
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);
        _verifyEndConditions(true);

        // Another withdraw
        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdraw(address(oethBaseVault), BaseAddresses.WETH, 1 ether);
        _verifyEndConditions(true);

        // WithdrawAll
        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdrawAll();
        _assertLpNotStakedInGauge();

        // Re-deposit + rebalance — LP re-staked
        _depositAsVault(5 ether);
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);
        _verifyEndConditions(true);
    }

    function test_rebalance_priceNearParity() public {
        // Push price very close to 1:1 (near upper tick boundary)
        uint160 priceAtTickHigher = aerodromeAMOStrategy.sqrtRatioX96TickHigher();
        uint160 priceAtTickLower = aerodromeAMOStrategy.sqrtRatioX96TickLower();
        uint160 pctTickerPrice = (priceAtTickHigher - priceAtTickLower) / 100;

        // Target: 99% of the way from lower to upper tick
        _pushPoolPrice(priceAtTickHigher - pctTickerPrice);

        // Supply WETH for rebalance
        _depositAsVault(1 ether);

        // Use quoter to find correct rebalance amount with wide interval
        _quoteAndRebalance(type(uint256).max, type(uint256).max);

        _verifyEndConditions(true);
    }

    function test_rebalance_priceOverParity() public {
        // Push price to 5% above lower tick (OETHb costs > WETH)
        uint160 priceAtTickHigher = aerodromeAMOStrategy.sqrtRatioX96TickHigher();
        uint160 priceAtTickLower = aerodromeAMOStrategy.sqrtRatioX96TickLower();
        uint160 twentyPctTickerPrice = (priceAtTickHigher - priceAtTickLower) / 20;

        _pushPoolPrice(priceAtTickLower + twentyPctTickerPrice);

        // Use quoter to find correct rebalance amount with wide interval
        _quoteAndRebalance(type(uint256).max, type(uint256).max);

        _verifyEndConditions(true);
    }

    function test_rebalance_priceBelowLowerTick() public {
        // Push price 5% below lower tick boundary
        uint160 priceAtTickHigher = aerodromeAMOStrategy.sqrtRatioX96TickHigher();
        uint160 priceAtTickLower = aerodromeAMOStrategy.sqrtRatioX96TickLower();
        uint160 fivePctTickerPrice = (priceAtTickHigher - priceAtTickLower) / 20;

        _pushPoolPrice(priceAtTickLower - fivePctTickerPrice);

        // Use quoter to find correct rebalance amount with wide interval
        _quoteAndRebalance(type(uint256).max, type(uint256).max);

        _verifyEndConditions(true);
    }

    function test_rebalance_RevertWhen_notEnoughWethForSwap() public {
        // NotEnoughWethForSwap is guarded by _ensureWETHBalance which fires
        // NotEnoughWethLiquidity first. So a large swap amount with insufficient
        // WETH in the position triggers NotEnoughWethLiquidity.
        _swapOnPool(4.99 ether, false);

        vm.prank(strategist);
        // Reverts with NotEnoughWethLiquidity(wethInPool, additionalWethRequired)
        vm.expectRevert();
        aerodromeAMOStrategy.rebalance(1000 ether, true, 0);
    }

    function test_rebalance_RevertWhen_notEnoughWethLiquidity() public {
        // Drain WETH from pool by swapping OETHb in
        _swapOnPool(5 ether, false);

        // Try rebalance that requires more WETH than is in the position
        vm.prank(strategist);
        // Reverts with NotEnoughWethLiquidity(wethInPool, additionalWethRequired)
        vm.expectRevert();
        aerodromeAMOStrategy.rebalance(1000000 ether, true, 0);
    }

    function test_rebalance_RevertWhen_outsideExpectedTickRange() public {
        // Push price above the upper tick boundary (tick >= 0)
        uint160 priceAtTick1;
        (bool ok, bytes memory data) =
            address(sugarHelper).staticcall(abi.encodeWithSignature("getSqrtRatioAtTick(int24)", int24(1)));
        require(ok, "getSqrtRatioAtTick failed");
        priceAtTick1 = abi.decode(data, (uint160));

        _pushPoolPrice(priceAtTick1);

        _depositAsVault(1 ether);

        vm.prank(strategist);
        // Reverts with OutsideExpectedTickRange(currentTick)
        vm.expectRevert();
        aerodromeAMOStrategy.rebalance(0, true, 0);
    }
}

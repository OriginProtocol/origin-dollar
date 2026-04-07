// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/unit/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";
import {IOETHSupernovaAMOStrategy} from "contracts/interfaces/strategies/IOETHSupernovaAMOStrategy.sol";

contract Unit_Concrete_OETHSupernovaAMOStrategy_SwapOTokensToPool_Test is Unit_OETHSupernovaAMOStrategy_Shared_Test {
    /// @dev Setup imbalanced pool (more WETH than OETH) and deposit LP for the strategy
    function _setupForSwapOTokensToPool() internal {
        _seedVaultForSolvency(1000 ether);
        // Imbalanced pool: more WETH than OETH (diff > 0)
        _setupPoolReserves(130 ether, 90 ether);
        _depositAsVault(20 ether);
    }

    function test_swapOTokensToPool_mintsOETHAndSwaps() public {
        _setupForSwapOTokensToPool();

        uint256 supplyBefore = oeth.totalSupply();

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapOTokensToPool(5 ether);

        // OETH supply should increase (minted for swap + minted for deposit)
        assertGt(oeth.totalSupply(), supplyBefore);
        // LP tokens should be in gauge (re-deposited)
        assertGt(mockSwapXGauge.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_swapOTokensToPool_emitsEvents() public {
        _setupForSwapOTokensToPool();

        // Expect SwapOTokensToPool event
        vm.expectEmit(false, false, false, false);
        emit IOETHSupernovaAMOStrategy.SwapOTokensToPool(0, 0, 0, 0);

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapOTokensToPool(5 ether);
    }

    function test_swapOTokensToPool_solvencyCheck() public {
        _setupForSwapOTokensToPool();

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapOTokensToPool(5 ether);

        // Verify solvency maintained
        uint256 totalValue = oethVault.totalValue();
        uint256 totalSupply = oeth.totalSupply();
        if (totalSupply > 0) {
            assertGe((totalValue * 1e18) / totalSupply, 0.998 ether);
        }
    }

    function test_swapOTokensToPool_RevertWhen_zeroAmount() public {
        vm.prank(strategist);
        vm.expectRevert("Must swap something");
        oethSupernovaAMOStrategy.swapOTokensToPool(0);
    }

    function test_swapOTokensToPool_RevertWhen_calledByNonStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist");
        oethSupernovaAMOStrategy.swapOTokensToPool(5 ether);
    }

    function test_swapOTokensToPool_RevertWhen_tooMuchOETHInStrategy() public {
        _setupForSwapOTokensToPool();

        // Put some OETH in the strategy
        vm.prank(address(oethVault));
        oeth.mint(address(oethSupernovaAMOStrategy), 10 ether);

        // Try to swap less than what is already in strategy
        vm.prank(strategist);
        vm.expectRevert("Too much OToken in strategy");
        oethSupernovaAMOStrategy.swapOTokensToPool(5 ether);
    }

    function test_swapOTokensToPool_RevertWhen_oTokensOvershotPeg() public {
        _seedVaultForSolvency(2000 ether);
        // Start with balanced pool, deposit LP
        _setupPoolReserves(100 ether, 100 ether);
        _depositAsVault(100 ether);

        // Imbalance pool: more WETH than OETH (diffBefore > 0)
        _setupPoolReserves(130 ether, 90 ether);

        // Set amountOut to near-zero so swap barely removes WETH from pool
        // but adds a lot of OETH, overshooting to OETH > WETH
        mockSwapXPair.setAmountOut(1);

        vm.prank(strategist);
        vm.expectRevert("OTokens overshot peg");
        oethSupernovaAMOStrategy.swapOTokensToPool(80 ether);
    }

    function test_swapOTokensToPool_RevertWhen_oTokensBalanceWorse() public {
        _seedVaultForSolvency(2000 ether);
        // Start with balanced pool, deposit LP
        _setupPoolReserves(100 ether, 100 ether);
        _depositAsVault(100 ether);

        // Imbalance pool: more OETH than WETH (diffBefore < 0)
        _setupPoolReserves(90 ether, 130 ether);

        // swapOTokensToPool adds OETH and removes WETH from pool.
        // On a pool already heavy in OETH, this worsens the OETH imbalance.
        vm.prank(strategist);
        vm.expectRevert("OTokens balance worse");
        oethSupernovaAMOStrategy.swapOTokensToPool(5 ether);
    }
}

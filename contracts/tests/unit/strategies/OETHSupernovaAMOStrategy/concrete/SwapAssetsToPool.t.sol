// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/unit/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
import {StableSwapAMMStrategy} from "contracts/strategies/algebra/StableSwapAMMStrategy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Unit_Concrete_OETHSupernovaAMOStrategy_SwapAssetsToPool_Test is Unit_OETHSupernovaAMOStrategy_Shared_Test {
    /// @dev Setup imbalanced pool (more OETH than WETH) and deposit LP for the strategy
    function _setupForSwapAssetsToPool() internal {
        _seedVaultForSolvency(1000 ether);
        // Start with balanced pool and deposit
        _setupPoolReserves(100 ether, 100 ether);
        _depositAsVault(20 ether);

        // Now imbalance pool: more OETH than WETH (diff < 0)
        // wethReserves=90e18, oethReserves=130e18
        _setupPoolReserves(90 ether, 130 ether);
    }

    function test_swapAssetsToPool_removesLPAndSwaps() public {
        _setupForSwapAssetsToPool();

        uint256 gaugeBalBefore = mockSwapXGauge.balanceOf(address(oethSupernovaAMOStrategy));

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapAssetsToPool(5 ether);

        // Gauge balance should decrease (LP removed)
        assertLt(mockSwapXGauge.balanceOf(address(oethSupernovaAMOStrategy)), gaugeBalBefore);
    }

    function test_swapAssetsToPool_burnsOETH() public {
        _setupForSwapAssetsToPool();

        uint256 supplyBefore = oeth.totalSupply();

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapAssetsToPool(5 ether);

        // OETH should have been burned
        assertLt(oeth.totalSupply(), supplyBefore);
    }

    function test_swapAssetsToPool_emitsEvents() public {
        _setupForSwapAssetsToPool();

        // Expect SwapAssetsToPool event
        vm.expectEmit(false, false, false, false);
        emit StableSwapAMMStrategy.SwapAssetsToPool(0, 0, 0);

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapAssetsToPool(5 ether);
    }

    function test_swapAssetsToPool_solvencyCheck() public {
        _setupForSwapAssetsToPool();

        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapAssetsToPool(5 ether);

        // Verify solvency maintained
        uint256 totalValue = oethVault.totalValue();
        uint256 totalSupply = oeth.totalSupply();
        if (totalSupply > 0) {
            assertGe((totalValue * 1e18) / totalSupply, 0.998 ether);
        }
    }

    function test_swapAssetsToPool_RevertWhen_zeroAmount() public {
        vm.prank(strategist);
        vm.expectRevert("Must swap something");
        oethSupernovaAMOStrategy.swapAssetsToPool(0);
    }

    function test_swapAssetsToPool_RevertWhen_calledByNonStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist");
        oethSupernovaAMOStrategy.swapAssetsToPool(5 ether);
    }

    function test_swapAssetsToPool_RevertWhen_assetsOvershotPeg() public {
        _seedVaultForSolvency(2000 ether);
        // Start with balanced pool, deposit lots of LP
        _setupPoolReserves(100 ether, 100 ether);
        _depositAsVault(100 ether);

        // Imbalance pool: more OETH than WETH (diffBefore < 0)
        _setupPoolReserves(90 ether, 130 ether);

        // Set amountOut to near-zero so swap barely removes OETH from pool
        // but LP removal + re-adding WETH overshoots to WETH > OETH
        mockSwapXPair.setAmountOut(1);

        vm.prank(strategist);
        vm.expectRevert("Assets overshot peg");
        oethSupernovaAMOStrategy.swapAssetsToPool(30 ether);
    }

    function test_swapAssetsToPool_RevertWhen_assetsBalanceWorse() public {
        _seedVaultForSolvency(2000 ether);
        // Start with balanced pool, deposit LP
        _setupPoolReserves(100 ether, 100 ether);
        _depositAsVault(100 ether);

        // Imbalance pool: more WETH than OETH (diffBefore > 0)
        _setupPoolReserves(130 ether, 90 ether);

        // swapAssetsToPool swaps WETH for OETH, removing OETH from pool.
        // On a pool with more WETH, this makes the WETH imbalance worse.
        vm.prank(strategist);
        vm.expectRevert("Assets balance worse");
        oethSupernovaAMOStrategy.swapAssetsToPool(5 ether);
    }

    function test_swapAssetsToPool_RevertWhen_positionBalanceWorsened() public {
        _seedVaultForSolvency(2000 ether);
        // Balanced pool and deposit
        _setupPoolReserves(100 ether, 100 ether);
        _depositAsVault(50 ether);

        // Keep pool balanced (diffBefore == 0)
        _setupPoolReserves(150 ether, 150 ether);

        // Any swap on a balanced pool will unbalance it
        vm.prank(strategist);
        vm.expectRevert("Position balance is worsened");
        oethSupernovaAMOStrategy.swapAssetsToPool(5 ether);
    }
}

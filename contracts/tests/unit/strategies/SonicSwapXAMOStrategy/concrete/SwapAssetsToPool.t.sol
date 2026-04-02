// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicSwapXAMOStrategy_Shared_Test} from "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";
import {ISonicSwapXAMOStrategy} from "contracts/interfaces/strategies/ISonicSwapXAMOStrategy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Unit_Concrete_SonicSwapXAMOStrategy_SwapAssetsToPool_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    /// @dev Setup imbalanced pool (more OS than wS) and deposit LP for the strategy
    function _setupForSwapAssetsToPool() internal {
        _seedVaultForSolvency(1000 ether);
        // Start with balanced pool and deposit
        _setupPoolReserves(100 ether, 100 ether);
        _depositAsVault(20 ether);

        // Now imbalance pool: more OS than wS (diff < 0)
        // wsReserves=90e18, osReserves=130e18
        _setupPoolReserves(90 ether, 130 ether);
    }

    function test_swapAssetsToPool_removesLPAndSwaps() public {
        _setupForSwapAssetsToPool();

        uint256 gaugeBalBefore = mockSwapXGauge.balanceOf(address(sonicSwapXAMOStrategy));

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapAssetsToPool(5 ether);

        // Gauge balance should decrease (LP removed)
        assertLt(mockSwapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), gaugeBalBefore);
    }

    function test_swapAssetsToPool_burnsOS() public {
        _setupForSwapAssetsToPool();

        uint256 supplyBefore = oSonic.totalSupply();

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapAssetsToPool(5 ether);

        // OS should have been burned
        assertLt(oSonic.totalSupply(), supplyBefore);
    }

    function test_swapAssetsToPool_emitsEvents() public {
        _setupForSwapAssetsToPool();

        // Expect SwapAssetsToPool event
        vm.expectEmit(false, false, false, false);
        emit ISonicSwapXAMOStrategy.SwapAssetsToPool(0, 0, 0);

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapAssetsToPool(5 ether);
    }

    function test_swapAssetsToPool_solvencyCheck() public {
        _setupForSwapAssetsToPool();

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapAssetsToPool(5 ether);

        // Verify solvency maintained
        uint256 totalValue = oSonicVault.totalValue();
        uint256 totalSupply = oSonic.totalSupply();
        if (totalSupply > 0) {
            assertGe((totalValue * 1e18) / totalSupply, 0.998 ether);
        }
    }

    function test_swapAssetsToPool_RevertWhen_zeroAmount() public {
        vm.prank(strategist);
        vm.expectRevert("Must swap something");
        sonicSwapXAMOStrategy.swapAssetsToPool(0);
    }

    function test_swapAssetsToPool_RevertWhen_calledByNonStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist");
        sonicSwapXAMOStrategy.swapAssetsToPool(5 ether);
    }

    function test_swapAssetsToPool_RevertWhen_assetsOvershotPeg() public {
        _seedVaultForSolvency(2000 ether);
        // Start with balanced pool, deposit lots of LP
        _setupPoolReserves(100 ether, 100 ether);
        _depositAsVault(100 ether);

        // Imbalance pool: more OS than wS (diffBefore < 0)
        _setupPoolReserves(90 ether, 130 ether);

        // Set amountOut to near-zero so swap barely removes OS from pool
        // but LP removal + re-adding wS overshoots to wS > OS
        mockSwapXPair.setAmountOut(1);

        vm.prank(strategist);
        vm.expectRevert("Assets overshot peg");
        sonicSwapXAMOStrategy.swapAssetsToPool(30 ether);
    }

    function test_swapAssetsToPool_RevertWhen_assetsBalanceWorse() public {
        _seedVaultForSolvency(2000 ether);
        // Start with balanced pool, deposit LP
        _setupPoolReserves(100 ether, 100 ether);
        _depositAsVault(100 ether);

        // Imbalance pool: more wS than OS (diffBefore > 0)
        _setupPoolReserves(130 ether, 90 ether);

        // swapAssetsToPool swaps wS for OS, removing OS from pool.
        // On a pool with more wS, this makes the wS imbalance worse.
        vm.prank(strategist);
        vm.expectRevert("Assets balance worse");
        sonicSwapXAMOStrategy.swapAssetsToPool(5 ether);
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
        sonicSwapXAMOStrategy.swapAssetsToPool(5 ether);
    }
}

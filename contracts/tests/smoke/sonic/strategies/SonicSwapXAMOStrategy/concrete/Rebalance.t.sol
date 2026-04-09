// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_SonicSwapXAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Smoke_Concrete_SonicSwapXAMOStrategy_Rebalance_Test is Smoke_SonicSwapXAMOStrategy_Shared_Test {
    function test_swapOTokensToPool_improvesBalance() public {
        // Pool on mainnet typically has more OS than wS.
        // Tilt pool heavily to more wS to flip the balance.
        _tiltPoolToMoreWS(200_000 ether);

        (uint256 wsBefore, uint256 osBefore,) = swapXPool.getReserves();
        int256 diffBefore = int256(wsBefore) - int256(osBefore);
        // Pool should be tilted to more wS
        assertGt(diffBefore, 0, "Pool should have more wS before rebalance");

        // Swap OS tokens to pool to improve balance
        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapOTokensToPool(1_000 ether);

        (uint256 wsAfter, uint256 osAfter,) = swapXPool.getReserves();
        int256 diffAfter = int256(wsAfter) - int256(osAfter);
        assertLt(diffAfter, diffBefore, "Pool imbalance should improve after swapOTokensToPool");
    }

    function test_swapAssetsToPool_improvesBalance() public {
        // First deposit so strategy has LP to withdraw from
        _depositToStrategy(5_000 ether);

        // Pool already has more OS than wS; tilt further if needed
        _tiltPoolToMoreOS(1_000 ether);

        (uint256 wsBefore, uint256 osBefore,) = swapXPool.getReserves();
        int256 diffBefore = int256(wsBefore) - int256(osBefore);
        // Pool should be tilted to more OS
        assertLt(diffBefore, 0, "Pool should have more OS before rebalance");

        // Swap wS to pool to improve balance
        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapAssetsToPool(1_000 ether);

        (uint256 wsAfter, uint256 osAfter,) = swapXPool.getReserves();
        int256 diffAfter = int256(wsAfter) - int256(osAfter);
        assertGt(diffAfter, diffBefore, "Pool imbalance should improve after swapAssetsToPool");
    }
}

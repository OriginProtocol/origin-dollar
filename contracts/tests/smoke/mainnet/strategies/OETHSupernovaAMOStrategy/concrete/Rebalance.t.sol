// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETHSupernovaAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Smoke_Concrete_OETHSupernovaAMOStrategy_Rebalance_Test is Smoke_OETHSupernovaAMOStrategy_Shared_Test {
    function test_swapOTokensToPool_improvesBalance() public {
        int256 diffBefore = _tiltPoolToMoreWETHUntilPositive();
        assertGt(diffBefore, 0, "Pool should have more WETH before rebalance");

        // Small swap to improve balance without overshooting
        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapOTokensToPool(0.03 ether);

        (uint256 assetAfter, uint256 oethAfter) = _getPoolReserves();
        int256 diffAfter = int256(assetAfter) - int256(oethAfter);
        assertLt(diffAfter, diffBefore, "Pool imbalance should improve after swapOTokensToPool");
    }

    function test_swapAssetsToPool_improvesBalance() public {
        // First deposit so strategy has LP to withdraw from
        _depositToStrategy(5 ether);

        // Tilt pool to have more OETH than WETH
        _tiltPoolToMoreOETH(2 ether);

        (uint256 assetBefore, uint256 oethBefore) = _getPoolReserves();
        int256 diffBefore = int256(assetBefore) - int256(oethBefore);
        // Pool should be tilted to more OETH
        assertLt(diffBefore, 0, "Pool should have more OETH before rebalance");

        // Small swap to improve balance without overshooting
        vm.prank(strategist);
        oethSupernovaAMOStrategy.swapAssetsToPool(0.3 ether);

        (uint256 assetAfter, uint256 oethAfter) = _getPoolReserves();
        int256 diffAfter = int256(assetAfter) - int256(oethAfter);
        assertGt(diffAfter, diffBefore, "Pool imbalance should improve after swapAssetsToPool");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Get the pool reserves in (asset, oToken) order regardless of pool token ordering
    function _getPoolReserves() internal view returns (uint256 assetReserves, uint256 oTokenReserves) {
        (uint256 reserve0, uint256 reserve1,) = supernovaPool.getReserves();
        uint256 oTokenPoolIndex = oethSupernovaAMOStrategy.oTokenPoolIndex();
        assetReserves = oTokenPoolIndex == 0 ? reserve1 : reserve0;
        oTokenReserves = oTokenPoolIndex == 0 ? reserve0 : reserve1;
    }

    function _tiltPoolToMoreWETHUntilPositive() internal returns (int256 diffAfterTilt) {
        uint256 amount = 2 ether;

        for (uint256 i = 0; i < 4; ++i) {
            _tiltPoolToMoreWETH(amount);

            (uint256 assetReserves, uint256 oTokenReserves) = _getPoolReserves();
            diffAfterTilt = int256(assetReserves) - int256(oTokenReserves);
            if (diffAfterTilt > 0) {
                return diffAfterTilt;
            }

            amount *= 2;
        }

        revert("Failed to tilt pool to more WETH");
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {INonfungiblePositionManager} from "contracts/interfaces/aerodrome/INonfungiblePositionManager.sol";

/// @dev Mock that implements the ISugarHelper ABI without inheriting the interface,
///      so that `getAmountsForLiquidity` can read storage (view) while the real
///      interface declares it `pure`.
contract MockSugarHelper {
    // Real sqrtRatioX96 values
    uint160 public constant SQRT_RATIO_TICK_MINUS_1 = 79223823835061661006824;
    uint160 public constant SQRT_RATIO_TICK_0 = 79228162514264337593543950336;

    // Configurable return values for principal
    uint256 public principalAmount0;
    uint256 public principalAmount1;

    // Configurable return for getAmountsForLiquidity
    uint256 public amountsForLiquidityAmount0;
    uint256 public amountsForLiquidityAmount1;

    // Configurable return for estimateAmount1
    uint256 private _estimateAmount1Override;
    bool private _useEstimateOverride;

    struct PopulatedTick {
        int24 tick;
        uint160 sqrtRatioX96;
        int128 liquidityNet;
        uint128 liquidityGross;
    }

    function getSqrtRatioAtTick(int24 tick) external pure returns (uint160 sqrtRatioX96) {
        if (tick == -1) return SQRT_RATIO_TICK_MINUS_1;
        if (tick == 0) return SQRT_RATIO_TICK_0;
        revert("Unsupported tick");
    }

    function getTickAtSqrtRatio(uint160) external pure returns (int24) {
        return -1; // simplified
    }

    function estimateAmount0(uint256, address, uint160, int24, int24) external pure returns (uint256) {
        revert("Not implemented");
    }

    function estimateAmount1(uint256 amount0, address, uint160, int24, int24) external view returns (uint256) {
        if (_useEstimateOverride) return _estimateAmount1Override;
        // Default: return same amount (near 1:1 at parity)
        return amount0;
    }

    function getAmountsForLiquidity(uint160, uint160, uint160, uint128 liquidity_)
        external
        view
        returns (uint256 amount0, uint256 amount1)
    {
        if (amountsForLiquidityAmount0 != 0 || amountsForLiquidityAmount1 != 0) {
            return (amountsForLiquidityAmount0, amountsForLiquidityAmount1);
        }
        // Default: return (0, liquidity) - mimics tick closest to parity
        return (0, uint256(liquidity_));
    }

    function getLiquidityForAmounts(uint256, uint256, uint160, uint160, uint160) external pure returns (uint128) {
        return 0;
    }

    function principal(INonfungiblePositionManager, uint256, uint160)
        external
        view
        returns (uint256 amount0, uint256 amount1)
    {
        return (principalAmount0, principalAmount1);
    }

    function fees(INonfungiblePositionManager, uint256) external pure returns (uint256, uint256) {
        return (0, 0);
    }

    function getPopulatedTicks(address, int24) external pure returns (PopulatedTick[] memory) {
        return new PopulatedTick[](0);
    }

    // Setters for tests
    function setPrincipal(uint256 _amount0, uint256 _amount1) external {
        principalAmount0 = _amount0;
        principalAmount1 = _amount1;
    }

    function setAmountsForLiquidity(uint256 _amount0, uint256 _amount1) external {
        amountsForLiquidityAmount0 = _amount0;
        amountsForLiquidityAmount1 = _amount1;
    }

    function setEstimateAmount1(uint256 _amount) external {
        _estimateAmount1Override = _amount;
        _useEstimateOverride = true;
    }

    function clearEstimateAmount1Override() external {
        _useEstimateOverride = false;
    }
}

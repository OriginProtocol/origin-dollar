// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {ICLPool} from "contracts/interfaces/aerodrome/ICLPool.sol";

contract MockCLPool is ICLPool {
    uint160 private _sqrtPriceX96;
    int24 private _tick;
    address private _token0;
    address private _token1;
    address private _gauge;
    uint128 private _liquidity;
    int24 private _tickSpacing = 1;

    constructor(address token0_, address token1_) {
        _token0 = token0_;
        _token1 = token1_;
    }

    function slot0()
        external
        view
        override
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            bool unlocked
        )
    {
        return (_sqrtPriceX96, _tick, 0, 0, 0, true);
    }

    function token0() external view override returns (address) {
        return _token0;
    }

    function token1() external view override returns (address) {
        return _token1;
    }

    function tickSpacing() external view override returns (int24) {
        return _tickSpacing;
    }

    function setTickSpacing(int24 tickSpacing_) external {
        _tickSpacing = tickSpacing_;
    }

    function gauge() external view override returns (address) {
        return _gauge;
    }

    function liquidity() external view override returns (uint128) {
        return _liquidity;
    }

    function ticks(int24)
        external
        view
        override
        returns (uint128, int128, uint256, uint256, int56, uint160, uint32, bool)
    {
        return (0, 0, 0, 0, 0, 0, 0, false);
    }

    // Setters
    function setSlot0(uint160 sqrtPriceX96_, int24 tick_) external {
        _sqrtPriceX96 = sqrtPriceX96_;
        _tick = tick_;
    }

    function setGauge(address gauge_) external {
        _gauge = gauge_;
    }

    function setLiquidity(uint128 liquidity_) external {
        _liquidity = liquidity_;
    }
}

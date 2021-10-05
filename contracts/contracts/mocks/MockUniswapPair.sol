// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IUniswapV2Pair } from "../interfaces/uniswap/IUniswapV2Pair.sol";

contract MockUniswapPair is IUniswapV2Pair {
    address tok0;
    address tok1;
    uint112 reserve0;
    uint112 reserve1;
    uint256 blockTimestampLast;

    bool public hasSynced = false;

    constructor(
        address _token0,
        address _token1,
        uint112 _reserve0,
        uint112 _reserve1
    ) {
        tok0 = _token0;
        tok1 = _token1;
        reserve0 = _reserve0;
        reserve1 = _reserve1;
        blockTimestampLast = block.timestamp;
    }

    function token0() external view override returns (address) {
        return tok0;
    }

    function token1() external view override returns (address) {
        return tok1;
    }

    function getReserves()
        external
        view
        override
        returns (
            uint112,
            uint112,
            uint32
        )
    {
        return (reserve0, reserve1, uint32(blockTimestampLast));
    }

    function setReserves(uint112 _reserve0, uint112 _reserve1) public {
        reserve0 = _reserve0;
        reserve1 = _reserve1;
        blockTimestampLast = block.timestamp;
    }

    // CAUTION This will not work if you setReserves multiple times over
    // multiple different blocks because then it wouldn't be a continuous
    // reserve factor over that blockTimestamp, this assumes an even reserve
    // ratio all the way through
    function price0CumulativeLast() external view override returns (uint256) {
        return
            uint256(FixedPoint.fraction(reserve1, reserve0)._x) *
            blockTimestampLast;
    }

    function price1CumulativeLast() external view override returns (uint256) {
        return
            uint256(FixedPoint.fraction(reserve0, reserve1)._x) *
            blockTimestampLast;
    }

    function sync() external override {
        hasSynced = true;
    }

    function checkHasSynced() external view {
        require(hasSynced, "Not synced");
    }
}

// a library for handling binary fixed point numbers (https://en.wikipedia.org/wiki/Q_(number_format))
library FixedPoint {
    // range: [0, 2**112 - 1]
    // resolution: 1 / 2**112
    struct uq112x112 {
        uint224 _x;
    }

    // returns a uq112x112 which represents the ratio of the numerator to the denominator
    // equivalent to encode(numerator).div(denominator)
    function fraction(uint112 numerator, uint112 denominator)
        internal
        pure
        returns (uq112x112 memory)
    {
        require(denominator > 0, "FixedPoint: DIV_BY_ZERO");
        return uq112x112((uint224(numerator) << 112) / denominator);
    }
}

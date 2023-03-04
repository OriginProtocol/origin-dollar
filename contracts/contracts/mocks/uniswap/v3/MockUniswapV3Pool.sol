// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IUniswapV3Helper } from "../../../interfaces/uniswap/v3/IUniswapV3Helper.sol";
import { ISwapRouter } from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract MockUniswapV3Pool {
    address public immutable token0;
    address public immutable token1;
    uint24 public immutable fee;

    uint160 public mockSqrtPriceX96;
    int24 public mockTick;
    IUniswapV3Helper internal uniswapV3Helper;

    constructor(
        address _token0,
        address _token1,
        uint24 _fee,
        address _helper
    ) {
        token0 = _token0;
        token1 = _token1;
        fee = _fee;
        uniswapV3Helper = IUniswapV3Helper(_helper);
    }

    function slot0()
        public
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        )
    {
        return (mockSqrtPriceX96, mockTick, 0, 0, 0, 0, true);
    }

    function setTick(int24 tick) public {
        mockTick = tick;
        mockSqrtPriceX96 = uniswapV3Helper.getSqrtRatioAtTick(tick);
    }

    function setVal(uint160 sqrtPriceX96, int24 tick) public {
        mockSqrtPriceX96 = sqrtPriceX96;
        mockTick = tick;
    }
}

interface IMockUniswapV3Pool {
    function setTick(int24 tick) external;

    function mockSqrtPriceX96() external returns (uint160);
}

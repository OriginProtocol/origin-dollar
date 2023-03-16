// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IStrategy } from "./IStrategy.sol";

interface IUniswapV3Strategy is IStrategy {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function reserveStrategy(address token) external view returns (address);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { StableMath } from "../utils/StableMath.sol";
import { Governable } from "../governance/Governable.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { BaseHarvester } from "./BaseHarvester.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";
import "../utils/Helpers.sol";

contract OETHHarvester is BaseHarvester {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using StableMath for uint256;

    constructor(address _vault, address _wethAddress) BaseHarvester(_vault, _wethAddress) {}

    function _getUniV2SwapPath(address token) internal override returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = baseTokenAddress; // WETH address
        return path;
    }

    function _getUniV3SwapPath(address token) internal override returns (bytes memory) {
        revert("Not yet implemented");
    }

    function _getBalancerPoolId(address token) internal override returns (bytes32) {
        revert("Not yet implemented");
    }
}

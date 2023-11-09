// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { StableMath } from "../utils/StableMath.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { BaseHarvester } from "./BaseHarvester.sol";
import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";
import "../utils/Helpers.sol";

contract Harvester is BaseHarvester {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using StableMath for uint256;

    address public immutable wethAddress;

    constructor(
        address _vault, 
        address _usdtAddress, 
        address _wethAddress
    ) BaseHarvester(_vault, _usdtAddress) {
        require(wethAddress != address(0), "Invalid WETH address");
        wethAddress = _wethAddress;
    }

    function _getUniV2SwapPath(address token) internal override returns (address[] memory) {
        address[] memory path = new address[](3);
        path[0] = token;
        path[1] = wethAddress;
        path[2] = baseTokenAddress; // USDT address
        return path;
    }

    function _getUniV3SwapPath(address token) internal override returns (bytes memory) {
        revert("Not yet implemented");
    }

    function _getBalancerPoolId(address token) internal override returns (bytes32) {
        revert("Not yet implemented");
    }
}

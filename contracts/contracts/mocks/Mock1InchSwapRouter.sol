// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IMintableERC20 } from "./MintableERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IAggregationExecutor, IOneInchRouter, SwapDescription } from "../interfaces/IOneInch.sol";

contract Mock1InchSwapRouter {
    event MockSwap(
        address executor, 
        bytes permitData, 
        bytes executorData
    );

    event MockSwapDesc(
        address srcToken,
        address dstToken,
        address srcReceiver,
        address dstReceiver,
        uint256 amount,
        uint256 minReturnAmount,
        uint256 flags
    );

    event MockUnoswapTo(
        address recipient, 
        address srcToken, 
        uint256 amount, 
        uint256 minReturn, 
        uint256[] pools
    );

    event MockUniswapV3SwapTo(
        address recipient, 
        uint256 amount, 
        uint256 minReturn, 
        uint256[] pools
    );

    function swap(
        address executor, 
        SwapDescription calldata desc, 
        bytes calldata permitData, 
        bytes calldata executorData
    ) public returns (uint256 returnAmount, uint256 spentAmount) {
        emit MockSwap(
            executor, 
            permitData, 
            executorData
        );
        _swapDesc(desc);
        returnAmount = 0;
        spentAmount = 0;
    }

    function _swapDesc(SwapDescription calldata desc) public {
        emit MockSwapDesc(
            address(desc.srcToken), 
            address(desc.dstToken), 
            desc.srcReceiver, 
            desc.dstReceiver, 
            desc.amount, 
            desc.minReturnAmount, 
            desc.flags
        );
    }

    function unoswapTo(
        address payable recipient, 
        address srcToken, 
        uint256 amount, 
        uint256 minReturn, 
        uint256[] calldata pools
    ) public returns(uint256 returnAmount) {
        emit MockUnoswapTo(recipient, srcToken, amount, minReturn, pools);
        returnAmount = 0;
    }

    function uniswapV3SwapTo(
        address payable recipient, 
        uint256 amount, 
        uint256 minReturn, 
        uint256[] calldata pools
    ) public returns(uint256 returnAmount) {
        emit MockUniswapV3SwapTo(recipient, amount, minReturn, pools);
        returnAmount = 0;
    }
}

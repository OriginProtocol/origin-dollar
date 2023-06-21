// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { SwapDescription } from "../interfaces/IOneInch.sol";

contract Mock1InchSwapRouter {
    using SafeERC20 for IERC20;

    event MockSwap(address executor, bytes permitData, bytes executorData);

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

    /**
     * @dev transfers the shource asset and returns the minReturnAmount of the destination asset.
     */
    function swap(
        address executor,
        SwapDescription calldata desc,
        bytes calldata permitData,
        bytes calldata executorData
    ) public returns (uint256 returnAmount, uint256 spentAmount) {
        // Transfer the source tokens to the receiver contract
        IERC20(desc.srcToken).safeTransferFrom(
            msg.sender,
            desc.srcReceiver,
            desc.amount
        );

        // Transfer the destination tokens to the recipient
        IERC20(desc.dstToken).safeTransfer(
            desc.dstReceiver,
            desc.minReturnAmount
        );

        emit MockSwap(executor, permitData, executorData);
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

    /**
     * @dev only transfers the source asset to this contract.
     * Ideally it would return the destination asset but that's encoded in the pools array.
     */
    function unoswapTo(
        address payable recipient,
        address srcToken,
        uint256 amount,
        uint256 minReturn,
        uint256[] calldata pools
    ) public returns (uint256 returnAmount) {
        // transfer the from asset from the caller
        IERC20(srcToken).safeTransferFrom(msg.sender, address(this), amount);

        emit MockUnoswapTo(recipient, srcToken, amount, minReturn, pools);
        returnAmount = 0;
    }

    /**
     * @dev does not do any transfers. Just emits MockUniswapV3SwapTo.
     */
    function uniswapV3SwapTo(
        address payable recipient,
        uint256 amount,
        uint256 minReturn,
        uint256[] calldata pools
    ) public returns (uint256 returnAmount) {
        emit MockUniswapV3SwapTo(recipient, amount, minReturn, pools);
        returnAmount = 0;
    }
}

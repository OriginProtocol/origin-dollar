// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// 1Inch swap data
struct SwapDescription {
    IERC20 srcToken; // contract address of a token to sell
    IERC20 dstToken; // contract address of a token to buy
    address payable srcReceiver;
    address payable dstReceiver; // Receiver of destination currency. default: fromAddress
    uint256 amount;
    uint256 minReturnAmount;
    uint256 flags;
}

/// @title Interface for making arbitrary calls during swap
interface IAggregationExecutor {
    /// @notice propagates information about original msg.sender and executes arbitrary data
    function execute(address msgSender) external payable; // 0x4b64e492
}

interface IOneInchRouter {
    /// @notice Performs a swap, delegating all calls encoded in `data` to `executor`.
    function swap(
        IAggregationExecutor executor,
        SwapDescription calldata desc,
        bytes calldata permit,
        bytes calldata data
    ) external returns (uint256 returnAmount, uint256 spentAmount);

    /// @notice Performs swap using Uniswap exchange. Wraps and unwraps ETH if required.
    function unoswapTo(
        address payable recipient,
        IERC20 srcToken,
        uint256 amount,
        uint256 minReturn,
        uint256[] calldata pools
    ) external payable returns (uint256 returnAmount);

    /// @notice Performs swap using Uniswap V3 exchange. Wraps and unwraps ETH if required.
    function uniswapV3SwapTo(
        address payable recipient,
        uint256 amount,
        uint256 minReturn,
        uint256[] calldata pools
    ) external payable returns (uint256 returnAmount);
}

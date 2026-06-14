// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapRouter} from "contracts/interfaces/aerodrome/ISwapRouter.sol";

contract MockSwapRouter is ISwapRouter {
    using SafeERC20 for IERC20;

    // Numerator and denominator for rate: amountOut = amountIn * rateNum / rateDen
    uint256 public rateNum = 1;
    uint256 public rateDen = 1;

    function setRate(uint256 _num, uint256 _den) external {
        rateNum = _num;
        rateDen = _den;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        override
        returns (uint256 amountOut)
    {
        // Transfer tokenIn from caller
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);

        amountOut = (params.amountIn * rateNum) / rateDen;
        require(amountOut >= params.amountOutMinimum, "Too little received");

        // Transfer tokenOut to recipient
        // The mock router must be pre-funded with tokenOut before the swap
        IERC20(params.tokenOut).safeTransfer(params.recipient, amountOut);
    }

    function exactInput(ExactInputParams calldata) external payable override returns (uint256) {
        revert("Not implemented");
    }

    function exactOutputSingle(ExactOutputSingleParams calldata) external payable override returns (uint256) {
        revert("Not implemented");
    }

    function exactOutput(ExactOutputParams calldata) external payable override returns (uint256) {
        revert("Not implemented");
    }
}

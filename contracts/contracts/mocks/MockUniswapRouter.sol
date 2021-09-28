// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";
import { Helpers } from "../utils/Helpers.sol";
import { StableMath } from "../utils/StableMath.sol";

contract MockUniswapRouter is IUniswapV2Router {
    using StableMath for uint256;

    address tok0;
    address tok1;

    function initialize(address _token0, address _token1) public {
        tok0 = _token0;
        tok1 = _token1;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external override returns (uint256[] memory amounts) {
        // Give 1:1
        uint256 amountOut = amountIn.scaleBy(
            Helpers.getDecimals(tok1),
            Helpers.getDecimals(tok0)
        );
        require(amountOut >= amountOutMin, "Slippage error");
        IERC20(tok0).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tok1).transfer(to, amountOut);
    }

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInput(ExactInputParams calldata params)
        external
        payable
        returns (uint256 amountOut)
    {
        amountOut = params.amountIn.scaleBy(
            Helpers.getDecimals(tok1),
            Helpers.getDecimals(tok0)
        );
        IERC20(tok0).transferFrom(msg.sender, address(this), params.amountIn);
        IERC20(tok1).transfer(params.recipient, amountOut);
        require(
            amountOut >= params.amountOutMinimum,
            "UniswapMock: amountOut less than amountOutMinimum"
        );
        return amountOut;
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        override
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        )
    {
        // this is needed to make this contract whole else it'd be just virtual
    }

    function WETH() external pure override returns (address) {
        return address(0);
    }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";
import { Helpers } from "../utils/Helpers.sol";
import { StableMath } from "../utils/StableMath.sol";

contract MockUniswapRouter is IUniswapV2Router {
    using StableMath for uint256;

    mapping(address => address) public pairMaps;

    function initialize(
        address[] calldata _0tokens,
        address[] calldata _1tokens
    ) public {
        require(
            _0tokens.length == _1tokens.length,
            "Mock token pairs should be of the same length"
        );
        for (uint256 i = 0; i < _0tokens.length; i++) {
            pairMaps[_0tokens[i]] = _1tokens[i];
        }
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external override returns (uint256[] memory amounts) {
        address tok0 = path[0];
        address tok1 = pairMaps[tok0];
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
        bytes memory tok0Bytes = new bytes(20);
        for (uint256 i = 0; i < 20; i++) {
            tok0Bytes[i] = params.path[i];
        }

        address tok0 = address(bytes20(tok0Bytes));
        address tok1 = pairMaps[tok0];

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

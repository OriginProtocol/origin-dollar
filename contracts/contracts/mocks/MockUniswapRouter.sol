// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MintableERC20 } from "./MintableERC20.sol";
import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";
import { Helpers } from "../utils/Helpers.sol";
import { StableMath } from "../utils/StableMath.sol";

contract MockUniswapRouter is IUniswapV2Router {
    using StableMath for uint256;

    mapping(address => address) public pairMaps;
    uint256 public slippage = 1 ether;

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

    function setSlippage(uint256 _slippage) external {
        slippage = _slippage;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        // solhint-disable-next-line no-unused-vars
        uint256
    ) external override returns (uint256[] memory amountsOut) {
        address tok0 = path[0];
        address tok1 = path[path.length - 1];

        uint256 amountOut = (amountOutMin * slippage) / 1 ether;
        require(amountOut >= amountOutMin, "Slippage error");

        IERC20(tok0).transferFrom(msg.sender, address(this), amountIn);
        MintableERC20(tok1).mintTo(to, amountOut);

        amountsOut = new uint256[](path.length);
        amountsOut[path.length - 1] = amountOut;
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
        (address tok0, address tok1) = _getFirstAndLastToken(params.path);

        amountOut = (params.amountOutMinimum * slippage) / 1 ether;

        IERC20(tok0).transferFrom(msg.sender, address(this), params.amountIn);
        MintableERC20(tok1).mintTo(params.recipient, amountOut);

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

    // Universal router mock
    function execute(
        bytes calldata,
        bytes[] calldata inputs,
        uint256
    ) external payable {
        uint256 inLen = inputs.length;
        for (uint256 i = 0; i < inLen; ++i) {
            (
                address recipient,
                ,
                uint256 amountOutMinimum,
                bytes memory path,

            ) = abi.decode(inputs[i], (address, uint256, uint256, bytes, bool));

            (address token0, address token1) = _getFirstAndLastToken(path);

            amountOutMinimum = amountOutMinimum.scaleBy(
                Helpers.getDecimals(token0),
                Helpers.getDecimals(token1)
            );

            MintableERC20(token1).mintTo(recipient, amountOutMinimum);
        }
    }

    function _getFirstAndLastToken(bytes memory path)
        internal
        view
        returns (address token0, address token1)
    {
        bytes memory tok0Bytes = new bytes(20);
        for (uint256 j = 0; j < 20; ++j) {
            tok0Bytes[j] = path[j];
        }
        token0 = address(bytes20(tok0Bytes));

        if (pairMaps[token0] != address(0)) {
            token0 = pairMaps[token0];
        }

        bytes memory tok1Bytes = new bytes(20);
        uint256 tok1Offset = path.length - 20;
        for (uint256 j = 0; j < 20; ++j) {
            tok1Bytes[j] = path[j + tok1Offset];
        }
        token1 = address(bytes20(tok1Bytes));

        if (pairMaps[token1] != address(0)) {
            token1 = pairMaps[token1];
        }
    }
}

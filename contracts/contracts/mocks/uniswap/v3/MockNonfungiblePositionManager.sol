// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IUniswapV3Helper } from "../../../interfaces/uniswap/v3/IUniswapV3Helper.sol";
import { IMockUniswapV3Pool } from "./MockUniswapV3Pool.sol";
// solhint-disable-next-line no-console
import "hardhat/console.sol";

contract MockNonfungiblePositionManager {
    using SafeERC20 for IERC20;

    uint128 public mockTokensOwed0;
    uint128 public mockTokensOwed1;

    struct MockPosition {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 token0Owed;
        uint128 token1Owed;
        uint128 liquidity;
        address recipient;
    }

    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    struct IncreaseLiquidityParams {
        uint256 tokenId;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    mapping(uint256 => MockPosition) public mockPositions;

    uint256 public slippage = 100;

    IUniswapV3Helper internal helper;
    IMockUniswapV3Pool internal mockPool;

    uint256 internal tokenCount = 0;

    constructor(address _helper, address _mockPool) {
        helper = IUniswapV3Helper(_helper);
        mockPool = IMockUniswapV3Pool(_mockPool);
    }

    function positions(uint256 tokenId)
        external
        view
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        )
    {
        MockPosition memory p = mockPositions[tokenId];
        return (
            0,
            address(0),
            address(0),
            address(0),
            p.fee,
            p.tickLower,
            p.tickUpper,
            p.liquidity,
            0,
            0,
            p.token0Owed,
            p.token1Owed
        );
    }

    function setTokensOwed(
        uint256 tokenId,
        uint128 token0,
        uint128 token1
    ) public {
        MockPosition storage p = mockPositions[tokenId];
        p.token0Owed = token0;
        p.token1Owed = token1;
    }

    function mint(MintParams calldata params)
        external
        payable
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        tokenCount += 1;
        tokenId = tokenCount;

        mockPositions[tokenId] = MockPosition({
            token0: params.token0,
            token1: params.token1,
            recipient: params.recipient,
            token0Owed: 0,
            token1Owed: 0,
            liquidity: 0,
            fee: params.fee,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper
        });

        MockPosition storage p = mockPositions[tokenId];

        (liquidity) = helper.getLiquidityForAmounts(
            mockPool.mockSqrtPriceX96(),
            helper.getSqrtRatioAtTick(p.tickLower),
            helper.getSqrtRatioAtTick(p.tickUpper),
            params.amount0Desired,
            params.amount1Desired
        );

        (amount0, amount1) = helper.getAmountsForLiquidity(
            mockPool.mockSqrtPriceX96(),
            helper.getSqrtRatioAtTick(p.tickLower),
            helper.getSqrtRatioAtTick(p.tickUpper),
            liquidity
        );

        IERC20(params.token0).safeTransferFrom(
            msg.sender,
            address(this),
            amount0
        );
        IERC20(params.token1).safeTransferFrom(
            msg.sender,
            address(this),
            amount1
        );

        p.liquidity += liquidity;

        require(amount0 >= params.amount0Min, "V3 Liquidity error");
        require(amount1 >= params.amount1Min, "V3 Liquidity error");
    }

    function increaseLiquidity(IncreaseLiquidityParams calldata params)
        external
        payable
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        MockPosition storage p = mockPositions[params.tokenId];

        (liquidity) = helper.getLiquidityForAmounts(
            mockPool.mockSqrtPriceX96(),
            helper.getSqrtRatioAtTick(p.tickLower),
            helper.getSqrtRatioAtTick(p.tickUpper),
            params.amount0Desired,
            params.amount1Desired
        );

        (amount0, amount1) = helper.getAmountsForLiquidity(
            mockPool.mockSqrtPriceX96(),
            helper.getSqrtRatioAtTick(p.tickLower),
            helper.getSqrtRatioAtTick(p.tickUpper),
            liquidity
        );

        IERC20(p.token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(p.token1).safeTransferFrom(msg.sender, address(this), amount1);

        p.liquidity += liquidity;

        require(amount0 >= params.amount0Min, "V3 Liquidity error");
        require(amount1 >= params.amount1Min, "V3 Liquidity error");
    }

    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1)
    {
        MockPosition storage p = mockPositions[params.tokenId];

        amount0 = params.amount0Min;
        amount1 = params.amount1Min;

        IMintableERC20(p.token0).mint(amount0);
        IMintableERC20(p.token1).mint(amount1);

        IERC20(p.token0).safeTransfer(p.recipient, amount0);
        IERC20(p.token1).safeTransfer(p.recipient, amount1);

        p.liquidity -= params.liquidity;
    }

    function collect(CollectParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1)
    {
        MockPosition storage p = mockPositions[params.tokenId];

        amount0 = p.token0Owed;
        amount1 = p.token1Owed;

        IMintableERC20(p.token0).mint(amount0);
        IMintableERC20(p.token1).mint(amount1);

        IERC20(p.token0).safeTransfer(p.recipient, amount0);
        IERC20(p.token1).safeTransfer(p.recipient, amount1);

        p.token0Owed = 0;
        p.token1Owed = 0;
    }

    function setSlippage(uint256 _slippage) public {
        slippage = _slippage;
    }
}

interface IMintableERC20 {
    function mint(uint256 value) external;

    function mintTo(address to, uint256 value) external;
}

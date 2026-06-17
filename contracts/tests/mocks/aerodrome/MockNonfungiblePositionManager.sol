// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {INonfungiblePositionManager} from "contracts/interfaces/aerodrome/INonfungiblePositionManager.sol";

contract MockNonfungiblePositionManager is INonfungiblePositionManager {
    using SafeERC20 for IERC20;

    uint256 private _nextTokenId = 1;

    struct Position {
        address token0;
        address token1;
        int24 tickSpacing;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint128 tokensOwed0;
        uint128 tokensOwed1;
    }

    mapping(uint256 => Position) private _positions;
    mapping(uint256 => address) private _owners;
    mapping(uint256 => address) private _approvals;

    function ownerOf(uint256 tokenId) external view override returns (address) {
        return _owners[tokenId];
    }

    function approve(address to, uint256 tokenId) external override {
        _approvals[tokenId] = to;
    }

    function getApproved(uint256 tokenId) external view override returns (address) {
        return _approvals[tokenId];
    }

    function positions(uint256 tokenId)
        external
        view
        override
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            int24 tickSpacing,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity_,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        )
    {
        Position memory p = _positions[tokenId];
        return (
            0,
            address(0),
            p.token0,
            p.token1,
            p.tickSpacing,
            p.tickLower,
            p.tickUpper,
            p.liquidity,
            0,
            0,
            p.tokensOwed0,
            p.tokensOwed1
        );
    }

    function mint(MintParams calldata params)
        external
        payable
        override
        returns (uint256 tokenId, uint128 liquidity_, uint256 amount0, uint256 amount1)
    {
        tokenId = _nextTokenId++;
        // Transfer tokens from caller
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        IERC20(params.token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(params.token1).safeTransferFrom(msg.sender, address(this), amount1);

        liquidity_ = uint128(amount0 + amount1); // simplified liquidity calc

        _positions[tokenId] = Position({
            token0: params.token0,
            token1: params.token1,
            tickSpacing: params.tickSpacing,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            liquidity: liquidity_,
            tokensOwed0: 0,
            tokensOwed1: 0
        });

        _owners[tokenId] = params.recipient;
    }

    function increaseLiquidity(IncreaseLiquidityParams calldata params)
        external
        payable
        override
        returns (uint128 liquidity_, uint256 amount0, uint256 amount1)
    {
        Position storage p = _positions[params.tokenId];
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        IERC20(p.token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(p.token1).safeTransferFrom(msg.sender, address(this), amount1);

        liquidity_ = uint128(amount0 + amount1);
        p.liquidity += liquidity_;
    }

    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        payable
        override
        returns (uint256 amount0, uint256 amount1)
    {
        Position storage p = _positions[params.tokenId];
        require(params.liquidity <= p.liquidity, "Insufficient liquidity");

        // Proportional amounts
        if (p.liquidity > 0) {
            uint256 totalToken0 = IERC20(p.token0).balanceOf(address(this));
            uint256 totalToken1 = IERC20(p.token1).balanceOf(address(this));
            amount0 = (totalToken0 * params.liquidity) / p.liquidity;
            amount1 = (totalToken1 * params.liquidity) / p.liquidity;
        }

        p.liquidity -= params.liquidity;
        p.tokensOwed0 += uint128(amount0);
        p.tokensOwed1 += uint128(amount1);
    }

    function collect(CollectParams calldata params)
        external
        payable
        override
        returns (uint256 amount0, uint256 amount1)
    {
        Position storage p = _positions[params.tokenId];
        amount0 = p.tokensOwed0 > params.amount0Max ? params.amount0Max : p.tokensOwed0;
        amount1 = p.tokensOwed1 > params.amount1Max ? params.amount1Max : p.tokensOwed1;

        p.tokensOwed0 -= uint128(amount0);
        p.tokensOwed1 -= uint128(amount1);

        if (amount0 > 0) {
            IERC20(p.token0).safeTransfer(params.recipient, amount0);
        }
        if (amount1 > 0) {
            IERC20(p.token1).safeTransfer(params.recipient, amount1);
        }
    }

    function burn(uint256 tokenId) external payable override {
        require(_positions[tokenId].liquidity == 0, "Liquidity not zero");
        delete _positions[tokenId];
        delete _owners[tokenId];
    }

    // Transfer ownership (used by gauge mock)
    function transferFrom(address from, address to, uint256 tokenId) external {
        require(_owners[tokenId] == from || _approvals[tokenId] == msg.sender || msg.sender == from, "Not authorized");
        _owners[tokenId] = to;
        _approvals[tokenId] = address(0);
    }

    function setTokenDescriptor(address) external override {}

    function setOwner(address) external override {}
}

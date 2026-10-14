// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IPoolManager, IUnlockCallback, PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";

/// @title V4Swapper
/// @notice Test actor that trades and provides liquidity directly against the Uniswap v4
///         PoolManager. Plays the USDe seller, the arbitrageur buying USDe back and a
///         second LP. Holds its own tokens and settles every delta with the pool.
contract V4Swapper is IUnlockCallback {
    uint160 internal constant MIN_SQRT_PRICE = 4295128739;
    uint160 internal constant MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342;

    IPoolManager public immutable poolManager;

    constructor(address _poolManager) {
        poolManager = IPoolManager(_poolManager);
    }

    /// @notice Exact-in swap with no price limit.
    /// @return amountOut Amount of the output currency received.
    function swap(PoolKey memory key, bool zeroForOne, uint256 amountIn) external returns (uint256 amountOut) {
        uint160 limit = zeroForOne ? MIN_SQRT_PRICE + 1 : MAX_SQRT_PRICE - 1;
        bytes memory result = poolManager.unlock(abi.encode(true, abi.encode(key, zeroForOne, amountIn, limit)));
        amountOut = abi.decode(result, (uint256));
    }

    /// @notice Add (positive) or remove (negative) liquidity as this contract.
    function modifyLiquidity(PoolKey memory key, int24 tickLower, int24 tickUpper, int256 liquidityDelta) external {
        poolManager.unlock(abi.encode(false, abi.encode(key, tickLower, tickUpper, liquidityDelta)));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "Not pool manager");
        (bool isSwap, bytes memory inner) = abi.decode(data, (bool, bytes));

        PoolKey memory key;
        int256 delta;
        bool zeroForOne;
        if (isSwap) {
            uint256 amountIn;
            uint160 limit;
            (key, zeroForOne, amountIn, limit) = abi.decode(inner, (PoolKey, bool, uint256, uint160));
            delta = poolManager.swap(
                key,
                IPoolManager.SwapParams({
                    zeroForOne: zeroForOne, amountSpecified: -int256(amountIn), sqrtPriceLimitX96: limit
                }),
                ""
            );
        } else {
            int24 tickLower;
            int24 tickUpper;
            int256 liquidityDelta;
            (key, tickLower, tickUpper, liquidityDelta) = abi.decode(inner, (PoolKey, int24, int24, int256));
            (delta,) = poolManager.modifyLiquidity(
                key,
                IPoolManager.ModifyLiquidityParams({
                    tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: liquidityDelta, salt: bytes32(0)
                }),
                ""
            );
        }

        int128 delta0 = int128(delta >> 128);
        int128 delta1 = int128(delta);
        _settle(key.currency0, delta0);
        _settle(key.currency1, delta1);

        int128 out = zeroForOne ? delta1 : delta0;
        return abi.encode(out > 0 ? uint256(uint128(out)) : 0);
    }

    function _settle(address currency, int128 delta) internal {
        if (delta < 0) {
            poolManager.sync(currency);
            IERC20(currency).transfer(address(poolManager), uint256(uint128(-delta)));
            poolManager.settle();
        } else if (delta > 0) {
            poolManager.take(currency, address(this), uint256(uint128(delta)));
        }
    }
}

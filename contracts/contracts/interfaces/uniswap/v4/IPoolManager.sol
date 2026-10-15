// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @notice Uniswap v4 pool key. In v4-core `currency0`, `currency1` and `hooks`
 *         are the `Currency` and `IHooks` user-defined types; both ABI-encode as
 *         `address`, so this struct produces the same selectors and calldata.
 */
struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

/**
 * @notice Minimal subset of the Uniswap v4 `IPoolManager` (v4-core 1.0.2) used
 *         by Origin. `BalanceDelta` is returned as its underlying `int256`:
 *         amount0 in the upper 128 bits, amount1 in the lower 128 bits.
 */
interface IPoolManager {
    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }

    struct ModifyLiquidityParams {
        int24 tickLower;
        int24 tickUpper;
        int256 liquidityDelta;
        bytes32 salt;
    }

    function unlock(bytes calldata data) external returns (bytes memory);

    function initialize(PoolKey memory key, uint160 sqrtPriceX96)
        external
        returns (int24 tick);

    function modifyLiquidity(
        PoolKey memory key,
        ModifyLiquidityParams memory params,
        bytes calldata hookData
    ) external returns (int256 callerDelta, int256 feesAccrued);

    function swap(
        PoolKey memory key,
        SwapParams memory params,
        bytes calldata hookData
    ) external returns (int256 swapDelta);

    function sync(address currency) external;

    function settle() external payable returns (uint256 paid);

    function take(
        address currency,
        address to,
        uint256 amount
    ) external;

    function extsload(bytes32 slot) external view returns (bytes32 value);
}

/// @notice Callback the PoolManager makes on the caller of `unlock`.
interface IUnlockCallback {
    function unlockCallback(bytes calldata data)
        external
        returns (bytes memory);
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IAbstractSafeModule } from "contracts/interfaces/automation/IAbstractSafeModule.sol";
import { PoolKey } from "contracts/interfaces/uniswap/v4/IPoolManager.sol";

interface IUniswapV4LiquidityModule is IAbstractSafeModule {
    /// @notice One `rebalance` call. Every field is the operator's decision.
    struct RebalanceParams {
        /// @dev Hookless pool to act on.
        PoolKey key;
        /// @dev Safe-owned position in that pool to burn first; 0 for none.
        uint256 tokenId;
        /// @dev Range of the new position.
        int24 tickLower;
        int24 tickUpper;
        /// @dev Liquidity of the new position; 0 to mint nothing.
        uint128 liquidity;
        /// @dev Most the mint may pull from the Safe, per currency.
        uint128 amount0Max;
        uint128 amount1Max;
        /// @dev Reset swap direction: true sells currency0 (price down).
        bool resetZeroForOne;
        /// @dev Exact input of the reset swap; 0 for no reset.
        uint128 resetAmountIn;
        /// @dev Price the reset swap stops at.
        uint160 sqrtPriceLimitX96;
    }

    event Rebalanced(
        bytes32 indexed poolId,
        uint256 indexed burnedTokenId,
        uint256 indexed mintedTokenId,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        bool resetZeroForOne,
        uint128 resetAmountIn
    );
    event MaxPerDaySet(address indexed token, uint256 amount);

    function poolManager() external view returns (address);

    function positionManager() external view returns (address);

    function maxPerDay(address token) external view returns (uint256);

    function spentOn(uint256 day, address token)
        external
        view
        returns (uint256);

    function rebalance(RebalanceParams calldata params)
        external
        returns (uint256 newTokenId);

    function unlockCallback(bytes calldata data)
        external
        returns (bytes memory);

    function setMaxPerDay(address token, uint256 amount) external;
}

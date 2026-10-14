// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IAbstractSafeModule } from "contracts/interfaces/automation/IAbstractSafeModule.sol";
import { PoolKey } from "contracts/interfaces/uniswap/v4/IPoolManager.sol";

interface IUniswapV4RebalanceModule is IAbstractSafeModule {
    /// @notice Why a position does or does not need a rebalance, and why a
    ///         re-add was skipped.
    enum Reason {
        None,
        NotConfigured,
        Paused,
        Balanced,
        PullNeeded,
        ReAddNeeded,
        PriceInRange,
        ExposureCap,
        AddFailed
    }

    /// @notice Limits the Safe sets on a position.
    struct PositionLimits {
        // Liquidity to keep in the position.
        uint128 targetLiquidity;
        // Hard cap on currency0 pulled by one add.
        uint128 maxAmount0;
        // Cap on currency0 sold by the reset swap. 0 disables the reset.
        uint128 maxResetAmount0;
        // No liquidity is added while the Safe holds this much currency1.
        uint256 maxToken1InSafe;
    }

    struct PositionConfig {
        PoolKey key;
        bytes32 poolId;
        int24 tickLower;
        int24 tickUpper;
        uint160 sqrtPriceLowerX96;
        uint160 sqrtPriceUpperX96;
        PositionLimits limits;
    }

    event PositionConfigured(
        uint256 indexed tokenId,
        bytes32 indexed poolId,
        int24 tickLower,
        int24 tickUpper,
        PositionLimits limits
    );
    event PositionRemoved(uint256 indexed tokenId);
    event Paused(address indexed by);
    event Unpaused();
    event LiquidityPulled(
        uint256 indexed tokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );
    event PriceReset(
        uint256 indexed tokenId,
        uint256 amount0In,
        uint256 amount1Out,
        uint160 sqrtPriceX96
    );
    event LiquidityAdded(
        uint256 indexed tokenId,
        uint128 liquidity,
        uint256 amount0
    );
    event ReAddSkipped(uint256 indexed tokenId, Reason reason);

    function poolManager() external view returns (address);

    function positionManager() external view returns (address);

    function permit2() external view returns (address);

    function paused() external view returns (bool);

    function configurePosition(uint256 tokenId, PositionLimits calldata limits)
        external;

    function removePosition(uint256 tokenId) external;

    function pause() external;

    function unpause() external;

    function rebalance(uint256 tokenId) external returns (bool added);

    function unlockCallback(bytes calldata data)
        external
        returns (bytes memory);

    function getPosition(uint256 tokenId)
        external
        view
        returns (PositionConfig memory);

    function configuredTokenIds() external view returns (uint256[] memory);

    function sqrtPriceX96(uint256 tokenId) external view returns (uint160);

    function pendingToken1(uint256 tokenId) external view returns (uint256);

    function rebalanceStatus(uint256 tokenId)
        external
        view
        returns (bool needed, Reason reason);
}

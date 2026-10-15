// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IAbstractSafeModule } from "contracts/interfaces/automation/IAbstractSafeModule.sol";
import { PoolKey } from "contracts/interfaces/uniswap/v4/IPoolManager.sol";

interface IUniswapV4ERC4626RebalanceModule is IAbstractSafeModule {
    event Rebalanced(
        uint256 indexed burnedTokenId,
        uint256 indexed mintedTokenId,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint128 resetAmount0
    );

    function poolManager() external view returns (address);

    function positionManager() external view returns (address);

    function currency0() external view returns (address);

    function currency1() external view returns (address);

    function poolId() external view returns (bytes32);

    function maxAmount0() external view returns (uint128);

    function navToleranceBps() external view returns (uint256);

    function poolKey() external view returns (PoolKey memory);

    function navPriceX192() external view returns (uint256);

    function navFloorX192() external view returns (uint256);

    function poolSqrtPriceX96() external view returns (uint160);

    function rebalance(
        uint256 tokenId,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint128 resetAmount0,
        uint160 sqrtPriceLimitX96
    ) external returns (uint256 newTokenId);

    function unlockCallback(bytes calldata data)
        external
        returns (bytes memory);
}

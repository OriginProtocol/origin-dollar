// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { PoolKey } from "./IPoolManager.sol";

/**
 * @notice Minimal subset of the Uniswap v4 `PositionManager` (v4-periphery
 *         444c526b, the mainnet deployment). `PositionInfo` is returned as its
 *         underlying `uint256`: bits 8-31 tickLower, 32-55 tickUpper, 56-255
 *         the truncated poolId.
 */
interface IPositionManager {
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline)
        external
        payable;

    function getPoolAndPositionInfo(uint256 tokenId)
        external
        view
        returns (PoolKey memory poolKey, uint256 info);

    function getPositionLiquidity(uint256 tokenId)
        external
        view
        returns (uint128 liquidity);

    function ownerOf(uint256 tokenId) external view returns (address);

    function nextTokenId() external view returns (uint256);
}

// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IMaverickV2Pool } from "./IMaverickV2Pool.sol";

import { IMaverickV2Position } from "./IMaverickV2Position.sol";
import { IMaverickV2PoolLens } from "./IMaverickV2PoolLens.sol";

interface IMaverickV2LiquidityManager {
    error LiquidityManagerNotFactoryPool();
    error LiquidityManagerNotTokenIdOwner();

    /**
     * @notice Maverick V2 NFT position contract that tracks NFT-based
     * liquditiy positions.
     */
    function position() external view returns (IMaverickV2Position);

    /**
     * @notice Create Maverick V2 pool.  Function is a pass through to the pool
     * factory and is provided here so that is can be assembled as part of a
     * multicall transaction.
     */
    function createPool(
        uint64 fee,
        uint16 tickSpacing,
        uint32 lookback,
        IERC20 tokenA,
        IERC20 tokenB,
        int32 activeTick,
        uint8 kinds
    ) external payable returns (IMaverickV2Pool pool);

    /**
     * @notice Add Liquidity position NFT for msg.sender by specifying
     * msg.sender's token index.
     * @dev Token index is different from tokenId.
     * On the Position NFT contract a user can own multiple NFT tokenIds and
     * these are indexes by an enumeration index which is the `index` input
     * here.
     *
     * See addLiquidity for a description of the add params.
     */
    function addPositionLiquidityToSenderByTokenIndex(
        IMaverickV2Pool pool,
        uint256 index,
        bytes memory packedSqrtPriceBreaks,
        bytes[] memory packedArgs
    )
        external
        payable
        returns (
            uint256 tokenAAmount,
            uint256 tokenBAmount,
            uint32[] memory binIds
        );

    /**
     * @notice Mint new tokenId in the Position NFt contract to msg.sender.
     * Both mints an NFT and adds liquidity to the pool that is held by the
     * NFT.
     */
    function mintPositionNftToSender(
        IMaverickV2Pool pool,
        bytes calldata packedSqrtPriceBreaks,
        bytes[] calldata packedArgs
    )
        external
        payable
        returns (
            uint256 tokenAAmount,
            uint256 tokenBAmount,
            uint32[] memory binIds,
            uint256 tokenId
        );

    /**
     * @notice Donates liqudity to a pool that is held by the position contract
     * and will never be retrievable.  Can be used to start a pool and ensure
     * there will always be a base level of liquditiy in the pool.
     */
    function donateLiquidity(
        IMaverickV2Pool pool,
        IMaverickV2Pool.AddLiquidityParams memory args
    ) external payable;

    /**
     * @notice Packs sqrtPrice breaks array with this format: [length,
     * array[0], array[1],..., array[length-1]] where length is 1 byte.
     */
    function packUint88Array(uint88[] memory fullArray)
        external
        pure
        returns (bytes memory packedArray);

    /**
     * @notice Packs addLiquidity paramters array element-wise.
     */
    function packAddLiquidityArgsArray(
        IMaverickV2Pool.AddLiquidityParams[] memory args
    ) external pure returns (bytes[] memory argsPacked);
}

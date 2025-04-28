// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.25;

import {IMaverickV2Factory} from "./IMaverickV2Factory.sol";
import {IMaverickV2Pool} from "./IMaverickV2Pool.sol";
import {ILiquidityRegistry} from "./ILiquidityRegistry.sol";

interface IMaverickV2Position {
    event PositionClearData(uint256 indexed tokenId);
    event PositionSetData(uint256 indexed tokenId, uint256 index, PositionPoolBinIds newData);
    event SetLpReward(ILiquidityRegistry lpReward);

    error PositionDuplicatePool(uint256 index, IMaverickV2Pool pool);
    error PositionNotFactoryPool();
    error PositionPermissionedLiquidityPool();

    struct PositionPoolBinIds {
        IMaverickV2Pool pool;
        uint32[] binIds;
    }

    struct PositionFullInformation {
        PositionPoolBinIds poolBinIds;
        uint256 amountA;
        uint256 amountB;
        uint256[] binAAmounts;
        uint256[] binBAmounts;
        int32[] ticks;
        uint256[] liquidities;
    }    

    /**
     * @notice Factory that tracks lp rewards.
     */
    function lpReward() external view returns (ILiquidityRegistry);

    /**
     * @notice Pool factory.
     */
    function factory() external view returns (IMaverickV2Factory);

    /**
     * @notice Mint NFT that holds liquidity in a Maverick V2 Pool. To mint
     * liquidity to an NFT, add liquidity to bins in a pool where the
     * add liquidity recipient is this contract and the subaccount is the
     * tokenId. LiquidityManager can be used to simplify minting Position NFTs.
     */
    function mint(address recipient, IMaverickV2Pool pool, uint32[] memory binIds) external returns (uint256 tokenId);

    /**
     * @notice Overwrites tokenId pool/binId information for a given data index.
     */
    function setTokenIdData(uint256 tokenId, uint256 index, IMaverickV2Pool pool, uint32[] memory binIds) external;

    /**
     * @notice Overwrites entire pool/binId data set for a given tokenId.
     */
    function setTokenIdData(uint256 tokenId, PositionPoolBinIds[] memory data) external;

    /**
     * @notice Append new pool/binIds data array to tokenId.
     */
    function appendTokenIdData(uint256 tokenId, IMaverickV2Pool pool, uint32[] memory binIds) external;

    /**
     * @notice Get array pool/binIds data for a given tokenId.
     */
    function getTokenIdData(uint256 tokenId) external view returns (PositionPoolBinIds[] memory);

    /**
     * @notice Get value from array of pool/binIds data for a given tokenId.
     */
    function getTokenIdData(uint256 tokenId, uint256 index) external view returns (PositionPoolBinIds memory);

    /**
     * @notice Length of array of pool/binIds data for a given tokenId.
     */
    function tokenIdDataLength(uint256 tokenId) external view returns (uint256 length);

    /**
     * @notice Remove liquidity from tokenId for a given pool.  User can
     * specify arbitrary bins to remove from for their subaccount in the pool
     * even if those bins are not in the tokenIdData set.
     */
    function removeLiquidity(
        uint256 tokenId,
        address recipient,
        IMaverickV2Pool pool,
        IMaverickV2Pool.RemoveLiquidityParams memory params
    ) external returns (uint256 tokenAAmount, uint256 tokenBAmount);

    /**
     * @notice Remove liquidity from tokenId for a given pool to sender.  User
     * can specify arbitrary bins to remove from for their subaccount in the
     * pool even if those bins are not in the tokenIdData set.
     */
    function removeLiquidityToSender(
        uint256 tokenId,
        IMaverickV2Pool pool,
        IMaverickV2Pool.RemoveLiquidityParams memory params
    ) external returns (uint256 tokenAAmount, uint256 tokenBAmount);

    /**
     * @notice NFT asset information for a given range of pool/binIds indexes.
     * This function only returns the liquidity in the pools/binIds stored as
     * part of the tokenIdData, but it is possible that the NFT has additional
     * liquidity in pools/binIds that have not been recorded.
     */
    function tokenIdPositionInformation(
        uint256 tokenId,
        uint256 startIndex,
        uint256 stopIndex
    ) external view returns (PositionFullInformation[] memory output);

    /**
     * @notice NFT asset information for a given pool/binIds index. This
     * function only returns the liquidity in the pools/binIds stored as part
     * of the tokenIdData, but it is possible that the NFT has additional
     * liquidity in pools/binIds that have not been recorded.
     */
    function tokenIdPositionInformation(
        uint256 tokenId,
        uint256 index
    ) external view returns (PositionFullInformation memory output);

    /**
     * @notice Get remove parameters for removing a fractional part of the
     * liquidity owned by a given tokenId.  The fractional factor to remove is
     * given by proporationD18 in 18-decimal scale.
     */
    function getRemoveParams(
        uint256 tokenId,
        uint256 index,
        uint256 proportionD18
    ) external view returns (IMaverickV2Pool.RemoveLiquidityParams memory params);

    /**
     * @notice Register the bin balances in the nft with the LpReward contract.
     */
    function checkpointBinLpBalance(uint256 tokenId, IMaverickV2Pool pool, uint32[] memory binIds) external;
}
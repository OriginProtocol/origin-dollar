// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractSafeModule } from "./AbstractSafeModule.sol";
import { ICLGauge } from "../interfaces/aerodrome/ICLGauge.sol";
import { ICLPool } from "../interfaces/aerodrome/ICLPool.sol";

struct BribePoolInfo {
    address poolAddress;
    address rewardContractAddress;
    address[] rewardTokens;
}

interface IAerodromeVoter {
    function claimBribes(
        address[] memory _bribes,
        address[][] memory _tokens,
        uint256 _tokenId
    ) external;
}

interface IVeNFT {
    function ownerOf(uint256 tokenId) external view returns (address);

    function ownerToNFTokenIdList(address owner, uint256 index)
        external
        view
        returns (uint256);
}

interface ICLRewardContract {
    function rewards(uint256 index) external view returns (address);

    function rewardsListLength() external view returns (uint256);
}

contract ClaimBribesSafeModule is AbstractSafeModule {
    IAerodromeVoter public immutable voter;
    address public immutable veNFT;

    uint256[] nftIds;
    mapping(uint256 => uint256) nftIdIndex;

    BribePoolInfo[] bribePools;
    mapping(address => uint256) bribePoolIndex;

    event NFTIdAdded(uint256 nftId);
    event NFTIdRemoved(uint256 nftId);

    event BribePoolAdded(address bribePool);
    event BribePoolRemoved(address bribePool);

    constructor(
        address _safeContract,
        address _voter,
        address _veNFT
    ) AbstractSafeModule(_safeContract) {
        voter = IAerodromeVoter(_voter);
        veNFT = _veNFT;
    }

    /**
     * @dev Claim bribes for a range of NFTs
     * @param nftIndexStart The start index of the NFTs
     * @param nftIndexEnd The end index of the NFTs
     * @param silent Doesn't revert if the claim fails when true
     */
    function claimBribes(
        uint256 nftIndexStart,
        uint256 nftIndexEnd,
        bool silent
    ) external onlyOperator {
        if (nftIndexEnd < nftIndexStart) {
            (nftIndexStart, nftIndexEnd) = (nftIndexEnd, nftIndexStart);
        }
        uint256 nftCount = nftIds.length;
        nftIndexEnd = nftCount < nftIndexEnd ? nftCount : nftIndexEnd;

        (
            address[] memory rewardContractAddresses,
            address[][] memory rewardTokens
        ) = _getRewardsInfoArray();

        for (uint256 i = nftIndexStart; i < nftIndexEnd; i++) {
            uint256 nftId = nftIds[i];
            bool success = safeContract.execTransactionFromModule(
                address(voter),
                0, // Value
                abi.encodeWithSelector(
                    IAerodromeVoter.claimBribes.selector,
                    rewardContractAddresses,
                    rewardTokens,
                    nftId
                ),
                0 // Call
            );

            require(success || silent, "ClaimBribes failed");
        }
    }

    /**
     * @dev Get the reward contract address and reward tokens for all pools
     * @return rewardContractAddresses The reward contract addresses
     * @return rewardTokens The reward tokens
     */
    function _getRewardsInfoArray()
        internal
        view
        returns (
            address[] memory rewardContractAddresses,
            address[][] memory rewardTokens
        )
    {
        BribePoolInfo[] memory _bribePools = bribePools;
        uint256 bribePoolCount = _bribePools.length;
        rewardContractAddresses = new address[](bribePoolCount);
        rewardTokens = new address[][](bribePoolCount);

        for (uint256 i = 0; i < bribePoolCount; i++) {
            rewardContractAddresses[i] = _bribePools[i].rewardContractAddress;
            rewardTokens[i] = _bribePools[i].rewardTokens;
        }
    }

    /***************************************
                NFT Management
    ****************************************/
    /**
     * @dev Add NFT IDs to the list
     * @param _nftIds The NFT IDs to add
     */
    function addNFTIds(uint256[] memory _nftIds) external onlyOperator {
        for (uint256 i = 0; i < _nftIds.length; i++) {
            uint256 nftId = _nftIds[i];
            if (nftIdExists(nftId)) {
                // If it already exists, skip
                continue;
            }

            // Make sure the NFT is owned by the Safe
            require(
                IVeNFT(veNFT).ownerOf(nftId) == address(safeContract),
                "NFT not owned by safe"
            );

            nftIdIndex[nftId] = nftIds.length;
            nftIds.push(nftId);

            emit NFTIdAdded(nftId);
        }
    }

    /**
     * @dev Remove NFT IDs from the list
     * @param _nftIds The NFT IDs to remove
     */
    function removeNFTIds(uint256[] memory _nftIds) external onlyOperator {
        for (uint256 i = 0; i < _nftIds.length; i++) {
            uint256 nftId = _nftIds[i];
            if (!nftIdExists(nftId)) {
                // If it doesn't exist, skip
                continue;
            }

            uint256 index = nftIdIndex[nftId];
            uint256 lastNftId = nftIds[nftIds.length - 1];
            nftIds[index] = lastNftId;
            nftIdIndex[lastNftId] = index;
            nftIds.pop();

            emit NFTIdRemoved(nftId);
        }
    }

    /**
     * @dev Check if a NFT exists on the list
     * @param nftId The NFT ID to check
     * @return true if the NFT ID exists, false otherwise
     */
    function nftIdExists(uint256 nftId) public view returns (bool) {
        uint256 index = nftIdIndex[nftId];
        uint256[] memory _nftIds = nftIds;
        return (index < _nftIds.length) && _nftIds[index] == nftId;
    }

    /**
     * @dev Get the length of the nftIds list
     * @return The length of the nftIds list
     */
    function getNFTIdsLength() external view returns (uint256) {
        return nftIds.length;
    }

    /**
     * @dev Get all NFT IDs
     * @return The NFT IDs
     */
    function getAllNFTIds() external view returns (uint256[] memory) {
        return nftIds;
    }

    /**
     * @dev Fetch all NFT IDs from the veNFT contract
     * @notice This can revert if Safe owns too many NFTs since tx will be huge.
     *         This function is public, anyone can call it, since it only fetches
     *         the NFT IDs owned by the Safe. It shouldn't cause us any issues.
     */
    function fetchNFTIds() external {
        // Purge the array
        delete nftIds;

        uint256 i = 0;
        while (true) {
            uint256 nftId = IVeNFT(veNFT).ownerToNFTokenIdList(
                address(safeContract),
                i
            );
            if (nftId == 0) {
                break;
            }

            nftIdIndex[nftId] = nftIds.length;
            nftIds.push(nftId);
            i++;
        }
    }

    /**
     * @dev Remove all NFT IDs from the list
     */
    function removeAllNFTIds() external onlyOperator {
        uint256 length = nftIds.length;
        for (uint256 i = 0; i < length; i++) {
            uint256 nftId = nftIds[i];
            delete nftIdIndex[nftId];
            emit NFTIdRemoved(nftId);
        }

        delete nftIds;
    }

    /***************************************
            Bribe Pool Management
    ****************************************/
    // @dev Whitelist a pool to claim bribes from
    // @param _poolAddress The address of the pool to whitelist
    function addBribePool(address _poolAddress, bool _isVotingContract)
        external
        onlySafe
    {
        BribePoolInfo memory bribePool;

        if (_isVotingContract) {
            bribePool = BribePoolInfo({
                poolAddress: _poolAddress,
                rewardContractAddress: _poolAddress,
                rewardTokens: _getRewardTokenAddresses(_poolAddress)
            });
        } else {
            // Find the gauge address
            address _gaugeAddress = ICLPool(_poolAddress).gauge();
            // And the reward contract address
            address _rewardContractAddress = ICLGauge(_gaugeAddress)
                .feesVotingReward();

            bribePool = BribePoolInfo({
                poolAddress: _poolAddress,
                rewardContractAddress: _rewardContractAddress,
                rewardTokens: _getRewardTokenAddresses(_rewardContractAddress)
            });
        }

        if (bribePoolExists(_poolAddress)) {
            // Update if it already exists
            bribePools[bribePoolIndex[_poolAddress]] = bribePool;
        } else {
            // If not, Append to the list
            bribePoolIndex[_poolAddress] = bribePools.length;
            bribePools.push(bribePool);
        }

        emit BribePoolAdded(_poolAddress);
    }

    /**
     * @dev Update the reward token addresses for all pools
     */
    function updateRewardTokenAddresses() external onlyOperator {
        BribePoolInfo[] storage _bribePools = bribePools;
        for (uint256 i = 0; i < _bribePools.length; i++) {
            BribePoolInfo storage bribePool = _bribePools[i];
            bribePool.rewardTokens = _getRewardTokenAddresses(
                bribePool.rewardContractAddress == bribePool.poolAddress
                    ? bribePool.poolAddress
                    : bribePool.rewardContractAddress
            );
        }
    }

    /**
     * @dev Get the reward token addresses for a given reward contract address
     * @param _rewardContractAddress The address of the reward contract
     * @return _rewardTokens The reward token addresses
     */
    function _getRewardTokenAddresses(address _rewardContractAddress)
        internal
        view
        returns (address[] memory)
    {
        address[] memory _rewardTokens = new address[](
            ICLRewardContract(_rewardContractAddress).rewardsListLength()
        );
        for (uint256 i = 0; i < _rewardTokens.length; i++) {
            _rewardTokens[i] = ICLRewardContract(_rewardContractAddress)
                .rewards(i);
        }

        return _rewardTokens;
    }

    /**
     * @dev Remove a bribe pool from the list
     * @param _poolAddress The address of the pool to remove
     */
    function removeBribePool(address _poolAddress) external onlySafe {
        if (!bribePoolExists(_poolAddress)) {
            // If it doesn't exist, skip
            return;
        }

        uint256 index = bribePoolIndex[_poolAddress];
        BribePoolInfo memory lastBribePool = bribePools[bribePools.length - 1];
        bribePools[index] = lastBribePool;
        bribePoolIndex[lastBribePool.poolAddress] = index;
        bribePools.pop();

        emit BribePoolRemoved(_poolAddress);
    }

    /**
     * @dev Check if a bribe pool exists
     * @param bribePool The address of the pool to check
     * @return true if the pool exists, false otherwise
     */
    function bribePoolExists(address bribePool) public view returns (bool) {
        BribePoolInfo[] memory _bribePools = bribePools;
        uint256 poolIndex = bribePoolIndex[bribePool];
        return
            poolIndex < _bribePools.length &&
            _bribePools[poolIndex].poolAddress == bribePool;
    }

    /**
     * @dev Get the length of the bribe pools list
     * @return The length of the bribe pools list
     */
    function getBribePoolsLength() external view returns (uint256) {
        return bribePools.length;
    }
}

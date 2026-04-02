// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IAbstractSafeModule} from "contracts/interfaces/automation/IAbstractSafeModule.sol";

interface IClaimBribesSafeModule is IAbstractSafeModule {
    event NFTIdAdded(uint256 nftId);
    event NFTIdRemoved(uint256 nftId);
    event BribePoolAdded(address bribePool);
    event BribePoolRemoved(address bribePool);

    function voter() external view returns (address);

    function veNFT() external view returns (address);

    function claimBribes(uint256 nftIndexStart, uint256 nftIndexEnd, bool silent) external;

    function addNFTIds(uint256[] memory _nftIds) external;

    function removeNFTIds(uint256[] memory _nftIds) external;

    function nftIdExists(uint256 nftId) external view returns (bool);

    function getNFTIdsLength() external view returns (uint256);

    function getAllNFTIds() external view returns (uint256[] memory);

    function fetchNFTIds() external;

    function removeAllNFTIds() external;

    function addBribePool(address _poolAddress, bool _isVotingContract) external;

    function updateRewardTokenAddresses() external;

    function removeBribePool(address _poolAddress) external;

    function bribePoolExists(address bribePool) external view returns (bool);

    function getBribePoolsLength() external view returns (uint256);
}

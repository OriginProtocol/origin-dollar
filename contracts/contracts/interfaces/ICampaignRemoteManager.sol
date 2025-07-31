// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ICampaignRemoteManager {
    function createCampaign(
        CampaignCreationParams memory params,
        uint256 destinationChainId,
        uint256 additionalGasLimit,
        address votemarket
    ) external payable;

    function manageCampaign(
        CampaignManagementParams memory params,
        uint256 destinationChainId,
        uint256 additionalGasLimit,
        address votemarket
    ) external payable;

    function closeCampaign(
        CampaignClosingParams memory params,
        uint256 destinationChainId,
        uint256 additionalGasLimit,
        address votemarket
    ) external payable;

    struct CampaignCreationParams {
        uint256 chainId;
        address gauge;
        address manager;
        address rewardToken;
        uint8 numberOfPeriods;
        uint256 maxRewardPerVote;
        uint256 totalRewardAmount;
        address[] addresses;
        address hook;
        bool isWhitelist;
    }

    struct CampaignManagementParams {
        uint256 campaignId;
        address rewardToken;
        uint8 numberOfPeriods;
        uint256 totalRewardAmount;
        uint256 maxRewardPerVote;
    }

    struct CampaignClosingParams {
        uint256 campaignId;
    }
}

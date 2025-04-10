// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMerklDistributor {
    struct CampaignParameters {
        // POPULATED ONCE CREATED

        // ID of the campaign. This can be left as a null bytes32 when creating campaigns
        // on Merkl.
        bytes32 campaignId;
        // CHOSEN BY CAMPAIGN CREATOR

        // Address of the campaign creator, if marked as address(0), it will be overriden with the
        // address of the `msg.sender` creating the campaign
        address creator;
        // Address of the token used as a reward
        address rewardToken;
        // Amount of `rewardToken` to distribute across all the epochs
        // Amount distributed per epoch is `amount/numEpoch`
        uint256 amount;
        // Type of campaign
        uint32 campaignType;
        // Timestamp at which the campaign should start
        uint32 startTimestamp;
        // Duration of the campaign in seconds. Has to be a multiple of EPOCH = 3600
        uint32 duration;
        // Extra data to pass to specify the campaign
        bytes campaignData;
    }

    function createCampaign(CampaignParameters memory newCampaign)
        external
        returns (bytes32);

    function signAndCreateCampaign(
        CampaignParameters memory newCampaign,
        bytes memory _signature
    ) external returns (bytes32);

    function sign(bytes memory _signature) external;

    function rewardTokenMinAmounts(address _rewardToken)
        external
        view
        returns (uint256);
}

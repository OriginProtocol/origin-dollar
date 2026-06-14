// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ICurvePoolBooster {
    event FeeUpdated(uint16 newFee);
    event FeeCollected(address feeCollector, uint256 feeAmount);
    event FeeCollectorUpdated(address newFeeCollector);
    event VotemarketUpdated(address newVotemarket);
    event CampaignRemoteManagerUpdated(address newCampaignRemoteManager);
    event CampaignCreated(
        address gauge,
        address rewardToken,
        uint256 maxRewardPerVote,
        uint256 totalRewardAmount
    );
    event CampaignIdUpdated(uint256 newId);
    event CampaignClosed(uint256 campaignId);
    event TotalRewardAmountUpdated(uint256 extraTotalRewardAmount);
    event NumberOfPeriodsUpdated(uint8 extraNumberOfPeriods);
    event RewardPerVoteUpdated(uint256 newMaxRewardPerVote);
    event TokensRescued(address token, uint256 amount, address receiver);

    function initialize(
        address _govenor,
        address _strategist,
        uint16 _fee,
        address _feeCollector,
        address _campaignRemoteManager,
        address _votemarket
    ) external;

    function initialize(
        address _strategist,
        uint16 _fee,
        address _feeCollector,
        address _campaignRemoteManager,
        address _votemarket
    ) external;

    function governor() external view returns (address);

    function isGovernor() external view returns (bool);

    function transferGovernance(address _newGovernor) external;

    function claimGovernance() external;

    function strategistAddr() external view returns (address);

    function gauge() external view returns (address);

    function rewardToken() external view returns (address);

    function fee() external view returns (uint16);

    function feeCollector() external view returns (address);

    function campaignRemoteManager() external view returns (address);

    function votemarket() external view returns (address);

    function campaignId() external view returns (uint256);

    function FEE_BASE() external view returns (uint16);

    function targetChainId() external view returns (uint256);

    function createCampaign(
        uint8 numberOfPeriods,
        uint256 maxRewardPerVote,
        address[] calldata blacklist,
        uint256 additionalGasLimit
    ) external payable;

    function manageCampaign(
        uint256 totalRewardAmount,
        uint8 numberOfPeriods,
        uint256 maxRewardPerVote,
        uint256 additionalGasLimit
    ) external payable;

    function closeCampaign(uint256 _campaignId, uint256 additionalGasLimit)
        external
        payable;

    function setCampaignId(uint256 _campaignId) external;

    function rescueETH(address receiver) external;

    function rescueToken(address token, address receiver) external;

    function setFee(uint16 _fee) external;

    function setFeeCollector(address _feeCollector) external;

    function setCampaignRemoteManager(address _campaignRemoteManager) external;

    function setVotemarket(address _votemarket) external;
}

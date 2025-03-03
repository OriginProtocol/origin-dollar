// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface IVotemarket {
    struct Campaign {
        uint256 chainId;
        address gauge;
        address manager;
        address rewardToken;
        uint8 numberOfPeriods;
        uint256 maxRewardPerVote;
        uint256 totalRewardAmount;
        uint256 totalDistributed;
        uint256 startTimestamp;
        uint256 endTimestamp;
        address hook;
    }

    struct CampaignUpgrade {
        uint8 numberOfPeriods;
        uint256 totalRewardAmount;
        uint256 maxRewardPerVote;
        uint256 endTimestamp;
    }

    struct Period {
        uint256 rewardPerPeriod;
        uint256 rewardPerVote;
        uint256 leftover;
        bool updated;
    }

    error AUTH_BLACKLISTED();
    error AUTH_GOVERNANCE_ONLY();
    error AUTH_MANAGER_ONLY();
    error AUTH_WHITELIST_ONLY();
    error CAMPAIGN_ENDED();
    error CAMPAIGN_NOT_ENDED();
    error CLAIM_AMOUNT_EXCEEDS_REWARD_AMOUNT();
    error EPOCH_NOT_VALID();
    error INVALID_INPUT();
    error INVALID_TOKEN();
    error IndexOutOfBounds();
    error PROTECTED_ACCOUNT();
    error Reentrancy();
    error STATE_MISSING();
    error ZERO_ADDRESS();
    error ZERO_INPUT();

    event CampaignClosed(uint256 campaignId);
    event CampaignCreated(
        uint256 campaignId,
        address gauge,
        address manager,
        address rewardToken,
        uint8 numberOfPeriods,
        uint256 maxRewardPerVote,
        uint256 totalRewardAmount
    );
    event CampaignUpgradeQueued(uint256 campaignId, uint256 epoch);
    event CampaignUpgraded(uint256 campaignId, uint256 epoch);
    event Claim(
        uint256 indexed campaignId,
        address indexed account,
        uint256 amount,
        uint256 fee,
        uint256 epoch
    );

    function CLAIM_WINDOW_LENGTH() external view returns (uint256);

    function CLOSE_WINDOW_LENGTH() external view returns (uint256);

    function EPOCH_LENGTH() external view returns (uint256);

    function MAX_ADDRESSES_PER_CAMPAIGN() external view returns (uint256);

    function MINIMUM_PERIODS() external view returns (uint8);

    function ORACLE() external view returns (address);

    function acceptGovernance() external;

    function addressesByCampaignId(uint256)
        external
        view
        returns (uint256 _spacer);

    function campaignById(uint256)
        external
        view
        returns (
            uint256 chainId,
            address gauge,
            address manager,
            address rewardToken,
            uint8 numberOfPeriods,
            uint256 maxRewardPerVote,
            uint256 totalRewardAmount,
            uint256 totalDistributed,
            uint256 startTimestamp,
            uint256 endTimestamp,
            address hook
        );

    function campaignCount() external view returns (uint256);

    function campaignUpgradeById(uint256, uint256)
        external
        view
        returns (
            uint8 numberOfPeriods,
            uint256 totalRewardAmount,
            uint256 maxRewardPerVote,
            uint256 endTimestamp
        );

    function claim(
        uint256 campaignId,
        uint256 epoch,
        bytes memory hookData,
        address receiver
    ) external returns (uint256 claimed);

    function claim(
        uint256 campaignId,
        address account,
        uint256 epoch,
        bytes memory hookData
    ) external returns (uint256 claimed);

    function closeCampaign(uint256 campaignId) external;

    function createCampaign(
        uint256 chainId,
        address gauge,
        address manager,
        address rewardToken,
        uint8 numberOfPeriods,
        uint256 maxRewardPerVote,
        uint256 totalRewardAmount,
        address[] memory addresses,
        address hook,
        bool isWhitelist
    ) external returns (uint256 campaignId);

    function currentEpoch() external view returns (uint256);

    function customFeeByManager(address) external view returns (uint256);

    function fee() external view returns (uint256);

    function feeCollector() external view returns (address);

    function futureGovernance() external view returns (address);

    function getAddressesByCampaign(uint256 campaignId)
        external
        view
        returns (address[] memory);

    function getCampaign(uint256 campaignId)
        external
        view
        returns (Campaign memory);

    function getCampaignUpgrade(uint256 campaignId, uint256 epoch)
        external
        view
        returns (CampaignUpgrade memory);

    function getPeriodPerCampaign(uint256 campaignId, uint256 epoch)
        external
        view
        returns (Period memory);

    function getRemainingPeriods(uint256 campaignId, uint256 epoch)
        external
        view
        returns (uint256 periodsLeft);

    function governance() external view returns (address);

    function increaseTotalRewardAmount(
        uint256 campaignId,
        uint256 totalRewardAmount
    ) external;

    function isClosedCampaign(uint256) external view returns (bool);

    function isProtected(address) external view returns (bool);

    function manageCampaign(
        uint256 campaignId,
        uint8 numberOfPeriods,
        uint256 totalRewardAmount,
        uint256 maxRewardPerVote
    ) external;

    function periodByCampaignId(uint256, uint256)
        external
        view
        returns (
            uint256 rewardPerPeriod,
            uint256 rewardPerVote,
            uint256 leftover,
            bool updated
        );

    function recipients(address) external view returns (address);

    function remote() external view returns (address);

    function setCustomFee(address _account, uint256 _fee) external;

    function setFee(uint256 _fee) external;

    function setFeeCollector(address _feeCollector) external;

    function setIsProtected(address _account, bool _isProtected) external;

    function setRecipient(address _recipient) external;

    function setRecipient(address _account, address _recipient) external;

    function setRemote(address _remote) external;

    function totalClaimedByAccount(
        uint256,
        uint256,
        address
    ) external view returns (uint256);

    function totalClaimedByCampaignId(uint256) external view returns (uint256);

    function transferGovernance(address _futureGovernance) external;

    function updateEpoch(
        uint256 campaignId,
        uint256 epoch,
        bytes memory hookData
    ) external returns (uint256 epoch_);

    function whitelistOnly(uint256) external view returns (bool);
}

// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

/**
 * @title Special Fee Contract for Sonic network
 * @notice The SFC maintains a list of validators and delegators and distributes rewards to them.
 * @custom:security-contact security@fantom.foundation
 */
interface ISFC {
    error StakeIsFullySlashed();

    event CreatedValidator(
        uint256 indexed validatorID,
        address indexed auth,
        uint256 createdEpoch,
        uint256 createdTime
    );
    event Delegated(
        address indexed delegator,
        uint256 indexed validatorID,
        uint256 amount
    );
    event Undelegated(
        address indexed delegator,
        uint256 indexed validatorID,
        uint256 indexed wrID,
        uint256 amount
    );
    event Withdrawn(
        address indexed delegator,
        uint256 indexed validatorID,
        uint256 indexed wrID,
        uint256 amount,
        uint256 penalty
    );
    event ClaimedRewards(
        address indexed delegator,
        uint256 indexed validatorID,
        uint256 rewards
    );
    event RestakedRewards(
        address indexed delegator,
        uint256 indexed validatorID,
        uint256 rewards
    );
    event BurntFTM(uint256 amount);
    event UpdatedSlashingRefundRatio(
        uint256 indexed validatorID,
        uint256 refundRatio
    );
    event RefundedSlashedLegacyDelegation(
        address indexed delegator,
        uint256 indexed validatorID,
        uint256 amount
    );

    event DeactivatedValidator(
        uint256 indexed validatorID,
        uint256 deactivatedEpoch,
        uint256 deactivatedTime
    );
    event ChangedValidatorStatus(uint256 indexed validatorID, uint256 status);
    event AnnouncedRedirection(address indexed from, address indexed to);

    function currentSealedEpoch() external view returns (uint256);

    function getEpochSnapshot(uint256 epoch)
        external
        view
        returns (
            uint256 endTime,
            uint256 endBlock,
            uint256 epochFee,
            uint256 baseRewardPerSecond,
            uint256 totalStake,
            uint256 totalSupply
        );

    function getStake(address delegator, uint256 validatorID)
        external
        view
        returns (uint256);

    function getValidator(uint256 validatorID)
        external
        view
        returns (
            uint256 status,
            uint256 receivedStake,
            address auth,
            uint256 createdEpoch,
            uint256 createdTime,
            uint256 deactivatedTime,
            uint256 deactivatedEpoch
        );

    function getValidatorID(address auth) external view returns (uint256);

    function getValidatorPubkey(uint256 validatorID)
        external
        view
        returns (bytes memory);

    function pubkeyAddressvalidatorID(address pubkeyAddress)
        external
        view
        returns (uint256);

    function getWithdrawalRequest(
        address delegator,
        uint256 validatorID,
        uint256 wrID
    )
        external
        view
        returns (
            uint256 epoch,
            uint256 time,
            uint256 amount
        );

    function isOwner() external view returns (bool);

    function lastValidatorID() external view returns (uint256);

    function minGasPrice() external view returns (uint256);

    function owner() external view returns (address);

    function renounceOwnership() external;

    function slashingRefundRatio(uint256 validatorID)
        external
        view
        returns (uint256);

    function stashedRewardsUntilEpoch(address delegator, uint256 validatorID)
        external
        view
        returns (uint256);

    function totalActiveStake() external view returns (uint256);

    function totalStake() external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function transferOwnership(address newOwner) external;

    function treasuryAddress() external view returns (address);

    function version() external pure returns (bytes3);

    function currentEpoch() external view returns (uint256);

    function updateConstsAddress(address v) external;

    function constsAddress() external view returns (address);

    function getEpochValidatorIDs(uint256 epoch)
        external
        view
        returns (uint256[] memory);

    function getEpochReceivedStake(uint256 epoch, uint256 validatorID)
        external
        view
        returns (uint256);

    function getEpochAccumulatedRewardPerToken(
        uint256 epoch,
        uint256 validatorID
    ) external view returns (uint256);

    function getEpochAccumulatedUptime(uint256 epoch, uint256 validatorID)
        external
        view
        returns (uint256);

    function getEpochAverageUptime(uint256 epoch, uint256 validatorID)
        external
        view
        returns (uint32);

    function getEpochAccumulatedOriginatedTxsFee(
        uint256 epoch,
        uint256 validatorID
    ) external view returns (uint256);

    function getEpochOfflineTime(uint256 epoch, uint256 validatorID)
        external
        view
        returns (uint256);

    function getEpochOfflineBlocks(uint256 epoch, uint256 validatorID)
        external
        view
        returns (uint256);

    function getEpochEndBlock(uint256 epoch) external view returns (uint256);

    function rewardsStash(address delegator, uint256 validatorID)
        external
        view
        returns (uint256);

    function createValidator(bytes calldata pubkey) external payable;

    function getSelfStake(uint256 validatorID) external view returns (uint256);

    function delegate(uint256 validatorID) external payable;

    function undelegate(
        uint256 validatorID,
        uint256 wrID,
        uint256 amount
    ) external;

    function isSlashed(uint256 validatorID) external view returns (bool);

    function withdraw(uint256 validatorID, uint256 wrID) external;

    function deactivateValidator(uint256 validatorID, uint256 status) external;

    function pendingRewards(address delegator, uint256 validatorID)
        external
        view
        returns (uint256);

    function stashRewards(address delegator, uint256 validatorID) external;

    function claimRewards(uint256 validatorID) external;

    function restakeRewards(uint256 validatorID) external;

    function updateSlashingRefundRatio(uint256 validatorID, uint256 refundRatio)
        external;

    function updateTreasuryAddress(address v) external;

    function burnFTM(uint256 amount) external;

    function sealEpoch(
        uint256[] calldata offlineTime,
        uint256[] calldata offlineBlocks,
        uint256[] calldata uptimes,
        uint256[] calldata originatedTxsFee
    ) external;

    function sealEpochValidators(uint256[] calldata nextValidatorIDs) external;

    function initialize(
        uint256 sealedEpoch,
        uint256 _totalSupply,
        address nodeDriver,
        address consts,
        address _owner
    ) external;

    function setGenesisValidator(
        address auth,
        uint256 validatorID,
        bytes calldata pubkey,
        uint256 createdTime
    ) external;

    function setGenesisDelegation(
        address delegator,
        uint256 validatorID,
        uint256 stake
    ) external;

    function updateStakeSubscriberAddress(address v) external;

    function stakeSubscriberAddress() external view returns (address);

    function setRedirectionAuthorizer(address v) external;

    function announceRedirection(address to) external;

    function initiateRedirection(address from, address to) external;

    function redirect(address to) external;
}

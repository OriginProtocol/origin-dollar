// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Initializable } from "../utils/Initializable.sol";
import { Strategizable } from "../governance/Strategizable.sol";
import { ICampaignRemoteManager } from "../interfaces/ICampaignRemoteManager.sol";

/// @title CurvePoolBooster
/// @author Origin Protocol
/// @notice Contract to manage interactions with VotemarketV2 for a dedicated Curve pool/gauge.
contract CurvePoolBooster is Initializable, Strategizable {
    using SafeERC20 for IERC20;

    ////////////////////////////////////////////////////
    /// --- CONSTANTS && IMMUTABLES
    ////////////////////////////////////////////////////
    /// @notice Base fee for the contract, 100%
    uint16 public constant FEE_BASE = 10_000;

    /// @notice Address of the gauge to manage
    address public immutable gauge;

    /// @notice Address of the reward token
    address public immutable rewardToken;

    /// @notice Address of the campaignRemoteManager linked to VotemarketV2
    address public immutable campaignRemoteManager;

    /// @notice Chain id of the target chain
    uint256 public immutable targetChainId;

    ////////////////////////////////////////////////////
    /// --- STORAGE
    ////////////////////////////////////////////////////
    /// @notice Fee in FEE_BASE unit payed when managing campaign.
    uint16 public fee;

    /// @notice Address of the fee collector
    address public feeCollector;

    /// @notice Id of the campaign created
    uint256 public campaignId;

    ////////////////////////////////////////////////////
    /// --- EVENTS
    ////////////////////////////////////////////////////
    event FeeUpdated(uint16 _newFee);
    event FeeCollected(address _feeCollector, uint256 _feeAmount);
    event FeeCollectorUpdated(address _newFeeCollector);
    event CampaignIdUpdated(uint256 _newId);
    event BribeCreated(
        address gauge,
        address rewardToken,
        uint256 maxRewardPerVote,
        uint256 totalRewardAmount
    );
    event TotalRewardAmountUpdated(uint256 extraTotalRewardAmount);
    event NumberOfPeriodsUpdated(uint8 extraNumberOfPeriods);
    event RewardPerVoteUpdated(uint256 newMaxRewardPerVote);
    event TokensRescued(address token, uint256 amount, address receiver);

    ////////////////////////////////////////////////////
    /// --- CONSTRUCTOR && INITIALIZATION
    ////////////////////////////////////////////////////
    constructor(
        uint256 _targetChainId,
        address _campaignRemoteManager,
        address _rewardToken,
        address _gauge
    ) {
        targetChainId = _targetChainId;
        campaignRemoteManager = _campaignRemoteManager;
        rewardToken = _rewardToken;
        gauge = _gauge;

        // Prevent implementation contract to be governed
        _setGovernor(address(0));
    }

    /// @notice initialize function, to set up initial internal state
    /// @param _strategist Address of the strategist
    /// @param _fee Fee in FEE_BASE unit payed when managing campaign
    /// @param _feeCollector Address of the fee collector
    function initialize(
        address _strategist,
        uint16 _fee,
        address _feeCollector
    ) external onlyGovernor initializer {
        _setStrategistAddr(_strategist);
        _setFee(_fee);
        _setFeeCollector(_feeCollector);
    }

    ////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    ////////////////////////////////////////////////////
    /// @notice Create a new campaign on VotemarketV2
    /// @dev This will use all token available in this contract
    /// @param numberOfPeriods Duration of the campaign in weeks
    /// @param maxRewardPerVote Maximum reward per vote to distribute, to avoid overspending
    /// @param blacklist  List of addresses to exclude from the campaign
    /// @param bridgeFee Fee to pay for the bridge
    /// @param additionalGasLimit Additional gas limit for the bridge
    function createCampaign(
        uint8 numberOfPeriods,
        uint256 maxRewardPerVote,
        address[] calldata blacklist,
        uint256 bridgeFee,
        uint256 additionalGasLimit
    ) external nonReentrant onlyGovernorOrStrategist {
        require(campaignId == 0, "Campaign already created");
        require(numberOfPeriods > 1, "Invalid number of periods");
        require(maxRewardPerVote > 0, "Invalid reward per vote");

        // Handle fee (if any)
        uint256 balanceSubFee = _handleFee();

        // Approve the balanceSubFee to the campaign manager
        IERC20(rewardToken).safeApprove(campaignRemoteManager, balanceSubFee);

        // Create a new campaign
        ICampaignRemoteManager(campaignRemoteManager).createCampaign{
            value: bridgeFee
        }(
            ICampaignRemoteManager.CampaignCreationParams({
                chainId: targetChainId,
                gauge: gauge,
                manager: address(this),
                rewardToken: rewardToken,
                numberOfPeriods: numberOfPeriods,
                maxRewardPerVote: maxRewardPerVote,
                totalRewardAmount: balanceSubFee,
                addresses: blacklist,
                hook: address(0),
                isWhitelist: false
            }),
            targetChainId,
            additionalGasLimit
        );

        emit BribeCreated(gauge, rewardToken, maxRewardPerVote, balanceSubFee);
    }

    /// @notice Manage the total reward amount of the campaign
    /// @dev This function should be called after the campaign is created
    /// @dev This will use all the token available in this contract
    /// @param bridgeFee Fee to pay for the bridge
    /// @param additionalGasLimit Additional gas limit for the bridge
    function manageTotalRewardAmount(
        uint256 bridgeFee,
        uint256 additionalGasLimit
    ) external nonReentrant onlyGovernorOrStrategist {
        require(campaignId != 0, "Campaign not created");

        // Handle fee (if any)
        uint256 balanceSubFee = _handleFee();

        // Approve the total reward amount to the campaign manager
        IERC20(rewardToken).safeApprove(campaignRemoteManager, balanceSubFee);

        // Manage the campaign
        // https://github.com/stake-dao/votemarket-v2/blob/main/packages/votemarket/src/Votemarket.sol#L668
        ICampaignRemoteManager(campaignRemoteManager).manageCampaign{
            value: bridgeFee
        }(
            ICampaignRemoteManager.CampaignManagementParams({
                campaignId: campaignId,
                rewardToken: rewardToken,
                numberOfPeriods: 0,
                totalRewardAmount: balanceSubFee,
                maxRewardPerVote: 0
            }),
            targetChainId,
            additionalGasLimit
        );

        emit TotalRewardAmountUpdated(balanceSubFee);
    }

    /// @notice Manage the number of periods of the campaign
    /// @dev This function should be called after the campaign is created
    /// @param extraNumberOfPeriods Number of additional periods (cannot be 0)
    ///         that will be added to already existing amount of periods.
    /// @param bridgeFee Fee to pay for the bridge
    /// @param additionalGasLimit Additional gas limit for the bridge
    function manageNumberOfPeriods(
        uint8 extraNumberOfPeriods,
        uint256 bridgeFee,
        uint256 additionalGasLimit
    ) external nonReentrant onlyGovernorOrStrategist {
        require(campaignId != 0, "Campaign not created");
        require(extraNumberOfPeriods > 0, "Invalid number of periods");

        // Manage the campaign
        ICampaignRemoteManager(campaignRemoteManager).manageCampaign{
            value: bridgeFee
        }(
            ICampaignRemoteManager.CampaignManagementParams({
                campaignId: campaignId,
                rewardToken: rewardToken,
                numberOfPeriods: extraNumberOfPeriods,
                totalRewardAmount: 0,
                maxRewardPerVote: 0
            }),
            targetChainId,
            additionalGasLimit
        );

        emit NumberOfPeriodsUpdated(extraNumberOfPeriods);
    }

    /// @notice Manage the reward per vote of the campaign
    /// @dev This function should be called after the campaign is created
    /// @param newMaxRewardPerVote New maximum reward per vote
    /// @param bridgeFee Fee to pay for the bridge
    /// @param additionalGasLimit Additional gas limit for the bridge
    function manageRewardPerVote(
        uint256 newMaxRewardPerVote,
        uint256 bridgeFee,
        uint256 additionalGasLimit
    ) external nonReentrant onlyGovernorOrStrategist {
        require(campaignId != 0, "Campaign not created");
        require(newMaxRewardPerVote > 0, "Invalid reward per vote");

        // Manage the campaign
        ICampaignRemoteManager(campaignRemoteManager).manageCampaign{
            value: bridgeFee
        }(
            ICampaignRemoteManager.CampaignManagementParams({
                campaignId: campaignId,
                rewardToken: rewardToken,
                numberOfPeriods: 0,
                totalRewardAmount: 0,
                maxRewardPerVote: newMaxRewardPerVote
            }),
            targetChainId,
            additionalGasLimit
        );

        emit RewardPerVoteUpdated(newMaxRewardPerVote);
    }

    /// @notice Take the balance of rewards tokens owned by this contract and calculate the fee amount.
    ///         Transfer the fee to the feeCollector.
    /// @return balance remaining balance of reward token
    function _handleFee() internal returns (uint256) {
        // Cache current rewardToken balance
        uint256 balance = IERC20(rewardToken).balanceOf(address(this));
        require(balance > 0, "No reward to manage");

        uint256 feeAmount = (balance * fee) / FEE_BASE;

        // If there is a fee, transfer it to the feeCollector
        if (feeAmount > 0) {
            // Transfer the fee to the feeCollector
            IERC20(rewardToken).transfer(feeCollector, feeAmount);
            emit FeeCollected(feeCollector, feeAmount);
        }

        // Return remaining balance
        return IERC20(rewardToken).balanceOf(address(this));
    }

    ////////////////////////////////////////////////////
    /// --- GOVERNANCE && OPERATION
    ////////////////////////////////////////////////////
    /// @notice Set the campaign id
    /// @dev Only callable by the governor or strategist
    /// @param _campaignId New campaign id
    function setCampaignId(uint256 _campaignId)
        external
        onlyGovernorOrStrategist
    {
        campaignId = _campaignId;
        emit CampaignIdUpdated(_campaignId);
    }

    /// @notice Rescue ETH from the contract
    /// @dev Only callable by the governor or strategist
    /// @param receiver Address to receive the ETH
    function rescueETH(address receiver)
        external
        nonReentrant
        onlyGovernorOrStrategist
    {
        require(receiver != address(0), "Invalid receiver");
        uint256 balance = address(this).balance;
        (bool success, ) = receiver.call{ value: balance }("");
        require(success, "Transfer failed");
        emit TokensRescued(address(0), balance, receiver);
    }

    /// @notice Rescue ERC20 tokens from the contract
    /// @dev Only callable by the governor or strategist
    /// @param token Address of the token to rescue
    function rescueToken(address token, address receiver)
        external
        nonReentrant
        onlyGovernor
    {
        require(receiver != address(0), "Invalid receiver");
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(receiver, balance);
        emit TokensRescued(token, balance, receiver);
    }

    /// @notice Set the fee
    /// @dev Only callable by the governor
    /// @param _fee New fee
    function setFee(uint16 _fee) external onlyGovernor {
        _setFee(_fee);
    }

    /// @notice Internal logic to set the fee
    function _setFee(uint16 _fee) internal {
        require(_fee <= FEE_BASE / 2, "Fee too high");
        fee = _fee;
        emit FeeUpdated(_fee);
    }

    /// @notice Set the fee collector
    /// @dev Only callable by the governor
    /// @param _feeCollector New fee collector
    function setFeeCollector(address _feeCollector) external onlyGovernor {
        _setFeeCollector(_feeCollector);
    }

    /// @notice Internal logic to set the fee collector
    function _setFeeCollector(address _feeCollector) internal {
        require(_feeCollector != address(0), "Invalid fee collector");
        feeCollector = _feeCollector;
        emit FeeCollectorUpdated(_feeCollector);
    }

    receive() external payable {}
}

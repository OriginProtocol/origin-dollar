// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Governable } from "../governance/Governable.sol";
import { Initializable } from "../utils/Initializable.sol";
import { ICampaingRemoteManager } from "../interfaces/ICampaignRemoteManager.sol";
import { Strategizable } from "../governance/Strategizable.sol";

contract CurvePoolBooster is Initializable, Strategizable {
    ////////////////////////////////////////////////////
    /// --- CONSTANTS && IMMUTABLES
    ////////////////////////////////////////////////////
    uint16 public constant BASE_FEE = 10_000; // 100%
    address public immutable gauge;
    address public immutable rewardToken;
    address public immutable campaignRemoteManager;
    uint256 public immutable targetChainId;

    ////////////////////////////////////////////////////
    /// --- STORAGE
    ////////////////////////////////////////////////////
    uint16 public fee;
    address public feeCollector;
    uint256 public campaignId;

    ////////////////////////////////////////////////////
    /// --- EVENTS
    ////////////////////////////////////////////////////
    event FeeSet(uint16 _newFee);
    event FeeCollectorSet(address _newFeeCollector);
    event CampaignIdSet(uint256 _newId);
    event BribeCreated(
        address gauge,
        address rewardToken,
        uint256 maxRewardPerVote,
        uint256 totalRewardAmount
    );
    event TotalRewardAmountManaged(uint256 extraTotalRewardAmount);
    event NumberOfPeriodsManaged(uint8 extraNumberOfPeriods);
    event RewardPerVoteManaged(uint256 newMaxRewardPerVote);
    event RescueTokens(address token, uint256 amount, address receiver);

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

    function initialize(
        address _strategist,
        uint16 _fee,
        address _feeCollector
    ) external initializer {
        _setStrategistAddr(_strategist);
        fee = _fee;
        feeCollector = _feeCollector;
    }

    ////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    ////////////////////////////////////////////////////
    function createCampaign(
        uint8 numberOfPeriods,
        uint256 maxRewardPerVote,
        address[] calldata blacklist,
        uint256 bridgeFee,
        uint256 additionalGasLimit
    ) external onlyGovernorOrStrategist {
        require(campaignId == 0, "Campaign already created");

        // Cache current rewardToken balance
        uint256 balance = IERC20(rewardToken).balanceOf(address(this));
        require(balance > 0, "No reward to manage");

        // Handle fee (if any)
        uint256 feeAmount = (balance * fee) / BASE_FEE;
        if (feeAmount > 0) {
            balance -= feeAmount;
            IERC20(rewardToken).transfer(feeCollector, feeAmount);
        }

        // Approve the balance to the campaign manager
        IERC20(rewardToken).approve(campaignRemoteManager, balance);

        // Create a new campaign
        ICampaingRemoteManager(campaignRemoteManager).createCampaign{
            value: bridgeFee
        }(
            ICampaingRemoteManager.CampaignCreationParams({
                chainId: targetChainId,
                gauge: gauge,
                manager: address(this),
                rewardToken: rewardToken,
                numberOfPeriods: numberOfPeriods,
                maxRewardPerVote: maxRewardPerVote,
                totalRewardAmount: balance,
                addresses: blacklist,
                hook: address(0),
                isWhitelist: false
            }),
            targetChainId,
            additionalGasLimit
        );

        emit BribeCreated(gauge, rewardToken, maxRewardPerVote, balance);
    }

    function manageTotalRewardAmount(
        uint256 bridgeFee,
        uint256 additionalGasLimit
    ) external onlyGovernorOrStrategist {
        require(campaignId != 0, "Campaign not created");

        // Cache current rewardToken balance
        uint256 balance = IERC20(rewardToken).balanceOf(address(this));
        require(balance > 0, "No reward to manage");

        // Handle fee (if any)
        uint256 feeAmount = (balance * fee) / BASE_FEE;
        if (feeAmount > 0) {
            balance -= feeAmount;
            IERC20(rewardToken).transfer(feeCollector, feeAmount);
        }

        // Approve the total reward amount to the campaign manager
        IERC20(rewardToken).approve(campaignRemoteManager, balance);

        // Manage the campaign
        ICampaingRemoteManager(campaignRemoteManager).manageCampaign{
            value: bridgeFee
        }(
            ICampaingRemoteManager.CampaignManagementParams({
                campaignId: campaignId,
                rewardToken: rewardToken,
                numberOfPeriods: 0,
                totalRewardAmount: balance,
                maxRewardPerVote: 0
            }),
            targetChainId,
            additionalGasLimit
        );

        emit TotalRewardAmountManaged(balance);
    }

    function manageNumberOfPeriods(
        uint8 extraNumberOfPeriods,
        uint256 bridgeFee,
        uint256 additionalGasLimit
    ) external onlyGovernorOrStrategist {
        require(campaignId != 0, "Campaign not created");
        require(extraNumberOfPeriods > 0, "Invalid number of periods");

        // Manage the campaign
        ICampaingRemoteManager(campaignRemoteManager).manageCampaign{
            value: bridgeFee
        }(
            ICampaingRemoteManager.CampaignManagementParams({
                campaignId: campaignId,
                rewardToken: rewardToken,
                numberOfPeriods: extraNumberOfPeriods,
                totalRewardAmount: 0,
                maxRewardPerVote: 0
            }),
            targetChainId,
            additionalGasLimit
        );

        emit NumberOfPeriodsManaged(extraNumberOfPeriods);
    }

    function manageRewardPerVote(
        uint256 newMaxRewardPerVote,
        uint256 bridgeFee,
        uint256 additionalGasLimit
    ) external onlyGovernorOrStrategist {
        require(campaignId != 0, "Campaign not created");
        require(newMaxRewardPerVote > 0, "Invalid reward per vote");

        // Manage the campaign
        ICampaingRemoteManager(campaignRemoteManager).manageCampaign{
            value: bridgeFee
        }(
            ICampaingRemoteManager.CampaignManagementParams({
                campaignId: campaignId,
                rewardToken: rewardToken,
                numberOfPeriods: 0,
                totalRewardAmount: 0,
                maxRewardPerVote: newMaxRewardPerVote
            }),
            targetChainId,
            additionalGasLimit
        );

        emit RewardPerVoteManaged(newMaxRewardPerVote);
    }

    ////////////////////////////////////////////////////
    /// --- GOVERNANCE && OPERATION
    ////////////////////////////////////////////////////
    function setCampaignId(uint256 _campaignId)
        external
        onlyGovernorOrStrategist
    {
        campaignId = _campaignId;
        emit CampaignIdSet(_campaignId);
    }

    function sendETH(address receiver) external onlyGovernorOrStrategist {
        emit RescueTokens(address(0), address(this).balance, receiver);
        payable(receiver).transfer(address(this).balance);
    }

    function rescueToken(
        address token,
        uint256 amount,
        address receiver
    ) external onlyGovernor {
        uint256 balance = IERC20(token).balanceOf(address(this));
        emit RescueTokens(token, amount, receiver);
        IERC20(token).transfer(receiver, balance);
    }

    function setFee(uint16 _fee) external onlyGovernor {
        require(_fee <= BASE_FEE / 2, "Fee too high");
        fee = _fee;
    }

    function setFeeCollector(address _feeCollector) external onlyGovernor {
        feeCollector = _feeCollector;
        emit FeeCollectorSet(_feeCollector);
    }

    receive() external payable {}
}

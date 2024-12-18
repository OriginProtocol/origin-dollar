// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Governable } from "../governance/Governable.sol";
import { Initializable } from "../utils/Initializable.sol";
import { ICampaingRemoteManager } from "../interfaces/ICampaignRemoteManager.sol";

contract CurvePoolBooster is Initializable, Governable {
    address public immutable gauge;
    address public immutable rewardToken;
    address public immutable campaignRemoteManager;
    uint256 public immutable targetChainId;

    address public operator;
    uint256 public campaignId;

    modifier onlyOperator() {
        require(
            msg.sender == operator || isGovernor(),
            "Only Operator or Governor"
        );
        _;
    }

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

    function initialize(address _operator) external initializer {
        operator = _operator;
    }

    function createCampaign(
        uint8 numberOfPeriods,
        uint256 maxRewardPerVote,
        uint256 bridgeFee,
        uint256 additionalGasLimit
    ) external onlyOperator {
        require(campaignId == 0, "Campaign already created");

        // Cache current rewardToken balance
        uint256 totalRewardAmount = IERC20(rewardToken).balanceOf(
            address(this)
        );

        // Approve the total reward amount to the campaign manager
        IERC20(rewardToken).approve(campaignRemoteManager, totalRewardAmount);

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
                totalRewardAmount: totalRewardAmount,
                addresses: new address[](0),
                hook: address(0),
                isWhitelist: false
            }),
            targetChainId,
            additionalGasLimit
        );
    }

    function manageTotalRewardAmount(
        uint256 bridgeFee,
        uint256 additionalGasLimit
    ) external onlyOperator {
        require(campaignId != 0, "Campaign not created");

        // Cache current rewardToken balance
        uint256 extraTotalRewardAmount = IERC20(rewardToken).balanceOf(
            address(this)
        );

        // Approve the total reward amount to the campaign manager
        require(extraTotalRewardAmount > 0, "No reward to manage");

        // Approve the total reward amount to the campaign manager
        IERC20(rewardToken).approve(
            campaignRemoteManager,
            extraTotalRewardAmount
        );

        // Manage the campaign
        ICampaingRemoteManager(campaignRemoteManager).manageCampaign{
            value: bridgeFee
        }(
            ICampaingRemoteManager.CampaignManagementParams({
                campaignId: campaignId,
                rewardToken: rewardToken,
                numberOfPeriods: 0,
                totalRewardAmount: extraTotalRewardAmount,
                maxRewardPerVote: 0
            }),
            targetChainId,
            additionalGasLimit
        );
    }

    function manageNumberOfPeriods(
        uint8 extraNumberOfPeriods,
        uint256 bridgeFee,
        uint256 additionalGasLimit
    ) external onlyOperator {
        require(campaignId != 0, "Campaign not created");

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
    }

    function manageRewardPerVote(
        uint256 newMaxRewardPerVote,
        uint256 bridgeFee,
        uint256 additionalGasLimit
    ) external onlyOperator {
        require(campaignId != 0, "Campaign not created");

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
    }

    function setCampaignId(uint256 _campaignId) external onlyOperator {
        campaignId = _campaignId;
    }

    function setOperator(address _newOperator) external onlyGovernor {
        operator = _newOperator;
    }

    function sendETH(address receiver) external onlyOperator {
        payable(receiver).transfer(address(this).balance);
    }

    receive() external payable {}
}

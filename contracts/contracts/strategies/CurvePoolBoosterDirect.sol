// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "../utils/Initializable.sol";
import {Strategizable} from "../governance/Strategizable.sol";
import {IVotemarket} from "../interfaces/IVotemarket.sol";

/// @title CurvePoolBooster
/// @author Origin Protocol
/// @notice Contract to manage interactions with VotemarketV2 for a dedicated Curve pool/gauge.
contract CurvePoolBoosterDirect is Initializable, Strategizable {
    using SafeERC20 for IERC20;

    ////////////////////////////////////////////////////
    /// --- CONSTANTS && IMMUTABLES
    ////////////////////////////////////////////////////
    /// @notice Base fee for the contract, 100%
    uint16 public constant FEE_BASE = 10_000;

    /// @notice Address of the gauge to manage
    address public immutable gauge;

    /// @notice Address of the reward token
    IERC20 public immutable rewardToken;

    /// @notice Address of votemarket in L2
    IVotemarket public immutable votemarket;

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
    event FeeUpdated(uint16 newFee);
    event FeeCollected(address feeCollector, uint256 feeAmount);
    event FeeCollectorUpdated(address newFeeCollector);
    event CampaignCreated(address gauge, address rewardToken, uint256 maxRewardPerVote, uint256 totalRewardAmount);

    ////////////////////////////////////////////////////
    /// --- CONSTRUCTOR && INITIALIZATION
    ////////////////////////////////////////////////////
    constructor(address _rewardToken, address _gauge, address _votemarket) {
        gauge = _gauge;
        votemarket = IVotemarket(_votemarket);
        rewardToken = IERC20(_rewardToken);

        // Prevent implementation contract to be governed
        _setGovernor(address(0));
    }

    function initialize(address _strategist, uint16 _fee, address _feeCollector) external onlyGovernor initializer {
        _setStrategistAddr(_strategist);
        _setFee(_fee);
        _setFeeCollector(_feeCollector);
    }

    ////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    ////////////////////////////////////////////////////
    function createCampaign(uint8 _numberOfPeriods, uint256 _maxRewardPerVote, address[] calldata _blacklist)
        external
        nonReentrant
        onlyGovernorOrStrategist
    {
        require(campaignId == 0, "Campaign already created");
        require(_numberOfPeriods > 1, "Invalid number of periods");
        require(_maxRewardPerVote > 0, "Invalid reward per vote");

        // Handle fee (if any)
        uint256 balanceSubFee = _handleFee();

        // Approve the reward token to votemarket
        rewardToken.safeApprove(address(votemarket), 0);
        rewardToken.safeApprove(address(votemarket), balanceSubFee);

        // Create the campaign
        campaignId = votemarket.createCampaign(
            block.chainid,
            gauge,
            address(this),
            address(rewardToken),
            _numberOfPeriods,
            _maxRewardPerVote,
            balanceSubFee,
            _blacklist,
            address(this),
            true
        );

        emit CampaignCreated(campaignId, _numberOfPeriods, _maxRewardPerVote, balanceSubFee);
    }

    /// @notice calculate the fee amount and transfer it to the feeCollector
    /// @return Balance after fee
    function _handleFee() internal returns (uint256) {
        // Cache current rewardToken balance
        uint256 balance = rewardToken.balanceOf(address(this));
        require(balance > 0, "No reward to manage");

        uint256 feeAmount = (balance * fee) / FEE_BASE;

        // If there is a fee, transfer it to the feeCollector
        if (feeAmount > 0) {
            // Transfer the fee to the feeCollector
            rewardToken.safeTransfer(feeCollector, feeAmount);
            emit FeeCollected(feeCollector, feeAmount);

            return rewardToken.balanceOf(address(this));
        }

        // Return remaining balance
        return balance;
    }

    ////////////////////////////////////////////////////
    /// --- GOVERNANCE && OPERATION
    ////////////////////////////////////////////////////
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
}

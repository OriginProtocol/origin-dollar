// SPDX-License-Identifier: BUSL-1.1
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

    /// @notice Arbitrum where the votemarket is running
    uint256 public constant targetChainId = 42161;

    /// @notice Address of the gauge to manage
    address public immutable gauge;

    /// @notice Address of the reward token
    address public immutable rewardToken;

    ////////////////////////////////////////////////////
    /// --- STORAGE
    ////////////////////////////////////////////////////

    /// @notice Fee in FEE_BASE unit payed when managing campaign.
    uint16 public fee;

    /// @notice Address of the fee collector
    address public feeCollector;

    /// @notice Address of the campaignRemoteManager linked to VotemarketV2
    address public campaignRemoteManager;

    /// @notice Address of votemarket in L2
    address public votemarket;

    /// @notice Id of the campaign created
    uint256 public campaignId;

    ////////////////////////////////////////////////////
    /// --- EVENTS
    ////////////////////////////////////////////////////
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

    ////////////////////////////////////////////////////
    /// --- CONSTRUCTOR && INITIALIZATION
    ////////////////////////////////////////////////////
    constructor(address _rewardToken, address _gauge) {
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
        address _feeCollector,
        address _campaignRemoteManager,
        address _votemarket
    ) external onlyGovernor initializer {
        _setStrategistAddr(_strategist);
        _setFee(_fee);
        _setFeeCollector(_feeCollector);
        _setCampaignRemoteManager(_campaignRemoteManager);
        _setVotemarket(_votemarket);
    }

    ////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    ////////////////////////////////////////////////////
    /// @notice Create a new campaign on VotemarketV2
    /// @dev This will use all token available in this contract
    /// @dev Caller must send ETH to pay for the bridge fee
    /// @param numberOfPeriods Duration of the campaign in weeks
    /// @param maxRewardPerVote Maximum reward per vote to distribute, to avoid overspending
    /// @param blacklist  List of addresses to exclude from the campaign
    /// @param additionalGasLimit Additional gas limit for the bridge
    function createCampaign(
        uint8 numberOfPeriods,
        uint256 maxRewardPerVote,
        address[] calldata blacklist,
        uint256 additionalGasLimit
    ) external payable nonReentrant onlyGovernorOrStrategist {
        require(campaignId == 0, "Campaign already created");
        require(numberOfPeriods > 1, "Invalid number of periods");
        require(maxRewardPerVote > 0, "Invalid reward per vote");

        // Handle fee (if any)
        uint256 balanceSubFee = _handleFee();

        // Approve the balanceSubFee to the campaign manager
        IERC20(rewardToken).safeApprove(campaignRemoteManager, 0);
        IERC20(rewardToken).safeApprove(campaignRemoteManager, balanceSubFee);

        // Create a new campaign
        ICampaignRemoteManager(campaignRemoteManager).createCampaign{
            value: msg.value
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
            additionalGasLimit,
            votemarket
        );

        emit CampaignCreated(
            gauge,
            rewardToken,
            maxRewardPerVote,
            balanceSubFee
        );
    }

    /// @notice Manage campaign parameters in a single call
    /// @dev This function should be called after the campaign is created
    /// @dev Caller must send ETH to pay for the bridge fee
    /// @param totalRewardAmount Amount of reward tokens to add:
    ///        - 0: no update
    ///        - type(uint256).max: use all tokens in contract
    ///        - other: use specific amount
    /// @param numberOfPeriods Number of additional periods (0 = no update)
    /// @param maxRewardPerVote New maximum reward per vote (0 = no update)
    /// @param additionalGasLimit Additional gas limit for the bridge
    function manageCampaign(
        uint256 totalRewardAmount,
        uint8 numberOfPeriods,
        uint256 maxRewardPerVote,
        uint256 additionalGasLimit
    ) external payable nonReentrant onlyGovernorOrStrategist {
        require(campaignId != 0, "Campaign not created");

        uint256 rewardAmount;

        if (totalRewardAmount != 0) {
            uint256 amount = min(
                IERC20(rewardToken).balanceOf(address(this)),
                totalRewardAmount
            );

            // Handle fee
            rewardAmount = _handleFee(amount);
            require(rewardAmount > 0, "No reward to add");

            // Approve the reward amount to the campaign manager
            IERC20(rewardToken).safeApprove(campaignRemoteManager, 0);
            IERC20(rewardToken).safeApprove(
                campaignRemoteManager,
                rewardAmount
            );
        }

        // Call remote manager
        ICampaignRemoteManager(campaignRemoteManager).manageCampaign{
            value: msg.value
        }(
            ICampaignRemoteManager.CampaignManagementParams({
                campaignId: campaignId,
                rewardToken: rewardToken,
                numberOfPeriods: numberOfPeriods,
                totalRewardAmount: rewardAmount,
                maxRewardPerVote: maxRewardPerVote
            }),
            targetChainId,
            additionalGasLimit,
            votemarket
        );

        // Emit relevant events
        if (rewardAmount > 0) {
            emit TotalRewardAmountUpdated(rewardAmount);
        }
        if (numberOfPeriods > 0) {
            emit NumberOfPeriodsUpdated(numberOfPeriods);
        }
        if (maxRewardPerVote > 0) {
            emit RewardPerVoteUpdated(maxRewardPerVote);
        }
    }

    /// @notice Close the campaign.
    /// @dev This function only work on the L2 chain. Not on mainnet.
    /// @dev Caller must send ETH to pay for the bridge fee
    /// @dev The _campaignId parameter is not related to the campaignId of this contract, allowing greater flexibility.
    /// @param _campaignId Id of the campaign to close
    /// @param additionalGasLimit Additional gas limit for the bridge
    // slither-disable-start reentrancy-eth
    function closeCampaign(uint256 _campaignId, uint256 additionalGasLimit)
        external
        payable
        nonReentrant
        onlyGovernorOrStrategist
    {
        ICampaignRemoteManager(campaignRemoteManager).closeCampaign{
            value: msg.value
        }(
            ICampaignRemoteManager.CampaignClosingParams({
                campaignId: campaignId
            }),
            targetChainId,
            additionalGasLimit,
            votemarket
        );
        campaignId = 0;
        emit CampaignClosed(_campaignId);
    }

    // slither-disable-end reentrancy-eth

    /// @notice Calculate the fee amount and transfer it to the feeCollector
    /// @dev Uses full contract balance
    /// @return Balance after fee
    function _handleFee() internal returns (uint256) {
        uint256 balance = IERC20(rewardToken).balanceOf(address(this));
        require(balance > 0, "No reward to manage");
        return _handleFee(balance);
    }

    /// @notice Calculate the fee amount and transfer it to the feeCollector
    /// @param amount Amount to take fee from
    /// @return Amount after fee
    function _handleFee(uint256 amount) internal returns (uint256) {
        uint256 feeAmount = (amount * fee) / FEE_BASE;

        // If there is a fee, transfer it to the feeCollector
        if (feeAmount > 0) {
            IERC20(rewardToken).safeTransfer(feeCollector, feeAmount);
            emit FeeCollected(feeCollector, feeAmount);
        }

        return amount - feeAmount;
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
        IERC20(token).safeTransfer(receiver, balance);
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

    /// @notice Set the campaignRemoteManager
    /// @param _campaignRemoteManager New campaignRemoteManager address
    function setCampaignRemoteManager(address _campaignRemoteManager)
        external
        onlyGovernor
    {
        _setCampaignRemoteManager(_campaignRemoteManager);
    }

    /// @notice Internal logic to set the campaignRemoteManager
    /// @param _campaignRemoteManager New campaignRemoteManager address
    function _setCampaignRemoteManager(address _campaignRemoteManager)
        internal
    {
        require(
            _campaignRemoteManager != address(0),
            "Invalid campaignRemoteManager"
        );
        campaignRemoteManager = _campaignRemoteManager;
        emit CampaignRemoteManagerUpdated(_campaignRemoteManager);
    }

    /// @notice Set the votemarket address
    /// @param _votemarket New votemarket address
    function setVotemarket(address _votemarket) external onlyGovernor {
        _setVotemarket(_votemarket);
    }

    /// @notice Internal logic to set the votemarket address
    function _setVotemarket(address _votemarket) internal {
        require(_votemarket != address(0), "Invalid votemarket");
        votemarket = _votemarket;
        emit VotemarketUpdated(_votemarket);
    }

    /// @notice Return the minimum of two uint256 numbers
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    receive() external payable {}
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPoolBooster} from "../interfaces/poolBooster/IPoolBooster.sol";
import {IMerklDistributor} from "../interfaces/poolBooster/IMerklDistributor.sol";
import {Strategizable} from "../governance/Strategizable.sol";
import {Initializable} from "../utils/Initializable.sol";

/// @title PoolBoosterMerklV2
/// @author Origin Protocol
/// @notice Pool booster that creates campaigns on the Merkl distributor to incentivize liquidity.
contract PoolBoosterMerklV2 is IPoolBooster, Strategizable, Initializable {
    using SafeERC20 for IERC20;

    ////////////////////////////////////////////////////
    /// --- CONSTANTS
    ////////////////////////////////////////////////////

    /// @notice Contract version
    string public constant VERSION = "1.0.0";

    /// @notice Minimum bribe amount to execute a bribe
    uint256 public constant MIN_BRIBE_AMOUNT = 1e10;

    ////////////////////////////////////////////////////
    /// --- STORAGE
    ////////////////////////////////////////////////////

    /// @notice Encoded campaign data passed to the Merkl distributor
    bytes public campaignData;

    /// @notice Duration of each campaign period in seconds
    uint32 public duration;

    /// @notice Type identifier for the Merkl campaign
    uint32 public campaignType;

    /// @notice Address of the reward token used for bribes
    address public rewardToken;

    /// @notice Merkl distributor contract used to create campaigns
    IMerklDistributor public merklDistributor;

    ////////////////////////////////////////////////////
    /// --- EVENTS
    ////////////////////////////////////////////////////

    event CampaignDataUpdated(bytes newCampaignData);
    event DurationUpdated(uint32 newDuration);
    event CampaignTypeUpdated(uint32 newCampaignType);
    event RewardTokenUpdated(address newRewardToken);
    event MerklDistributorUpdated(address newMerklDistributor);
    event TokensRescued(address token, uint256 amount, address receiver);

    ////////////////////////////////////////////////////
    /// --- CONSTRUCTOR && INITIALIZATION
    ////////////////////////////////////////////////////

    constructor() {
        _setGovernor(address(msg.sender));
    }

    /// @notice Initialize the contract with campaign parameters and governance
    /// @param _duration Duration of each campaign period
    /// @param _campaignType Type identifier for the Merkl campaign
    /// @param _rewardToken Address of the reward token
    /// @param _merklDistributor Address of the Merkl distributor contract
    /// @param _governor Address of the governor
    /// @param _strategist Address of the strategist
    /// @param _campaignData Encoded campaign data passed to the Merkl distributor
    function initialize(
        uint32 _duration,
        uint32 _campaignType,
        address _rewardToken,
        address _merklDistributor,
        address _governor,
        address _strategist,
        bytes calldata _campaignData
    ) external initializer {
        _setDuration(_duration);
        _setCampaignType(_campaignType);
        _setRewardToken(_rewardToken);
        _setMerklDistributor(_merklDistributor);
        _setGovernor(_governor);
        _setStrategistAddr(_strategist);
        _setCampaignData(_campaignData);

        merklDistributor.acceptConditions();
    }

    ////////////////////////////////////////////////////
    /// --- CORE LOGIC
    ////////////////////////////////////////////////////

    /// @notice Execute a bribe by creating a campaign on the Merkl distributor
    /// @dev Skips silently if balance is below MIN_BRIBE_AMOUNT or insufficient for the duration
    function bribe() external onlyGovernorOrStrategist {
        // Ensure token is approved for the Merkl distributor
        uint256 minAmount = merklDistributor.rewardTokenMinAmounts(rewardToken);
        require(minAmount > 0, "Min reward amount must be > 0");

        // if balance too small or below threshold, do no bribes
        uint256 balance = IERC20(rewardToken).balanceOf(address(this));
        if (balance < MIN_BRIBE_AMOUNT || (balance * 1 hours < minAmount * duration)) {
            return;
        }

        // Approve the bribe contract to spend the reward token
        IERC20(rewardToken).approve(address(merklDistributor), balance);

        // Notify the bribe contract of the reward amount
        merklDistributor.createCampaign(
            IMerklDistributor.CampaignParameters({
                campaignId: bytes32(0),
                creator: strategistAddr,
                rewardToken: rewardToken,
                amount: balance,
                campaignType: campaignType,
                startTimestamp: getNextPeriodStartTime(),
                duration: duration,
                campaignData: campaignData
            })
        );
        emit BribeExecuted(balance);
    }

    ////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    ////////////////////////////////////////////////////

    /// @notice Returns the timestamp for the start of the next period based on the configured duration
    /// @return The next period start timestamp as uint32
    function getNextPeriodStartTime() public view returns (uint32) {
        return uint32((block.timestamp / duration + 1) * duration);
    }

    ////////////////////////////////////////////////////
    /// --- SETTERS
    ////////////////////////////////////////////////////

    /// @notice Set the campaign data
    /// @param _campaignData New campaign data
    function setCampaignData(bytes calldata _campaignData) external onlyGovernorOrStrategist {
        _setCampaignData(_campaignData);
    }

    /// @notice Internal logic to set the campaign data
    /// @param _campaignData New campaign data
    function _setCampaignData(bytes calldata _campaignData) internal {
        campaignData = _campaignData;
        emit CampaignDataUpdated(_campaignData);
    }

    /// @notice Set the duration
    /// @param _duration New duration
    function setDuration(uint32 _duration) external onlyGovernorOrStrategist {
        _setDuration(_duration);
    }

    /// @notice Internal logic to set the duration
    /// @param _duration New duration, must be greater than 1 hour
    function _setDuration(uint32 _duration) internal {
        require(_duration > 1 hours, "Invalid duration");
        duration = _duration;
        emit DurationUpdated(_duration);
    }

    /// @notice Set the campaign type
    /// @param _campaignType New campaign type
    function setCampaignType(uint32 _campaignType) external onlyGovernorOrStrategist {
        _setCampaignType(_campaignType);
    }

    /// @notice Internal logic to set the campaign type
    /// @param _campaignType New campaign type
    function _setCampaignType(uint32 _campaignType) internal {
        campaignType = _campaignType;
        emit CampaignTypeUpdated(_campaignType);
    }

    /// @notice Set the reward token
    /// @param _rewardToken New reward token address
    function setRewardToken(address _rewardToken) external onlyGovernorOrStrategist {
        _setRewardToken(_rewardToken);
    }

    /// @notice Internal logic to set the reward token
    /// @param _rewardToken New reward token address, must be non-zero
    function _setRewardToken(address _rewardToken) internal {
        require(_rewardToken != address(0), "Invalid rewardToken address");
        rewardToken = _rewardToken;
        emit RewardTokenUpdated(_rewardToken);
    }

    /// @notice Set the Merkl distributor
    /// @param _merklDistributor New Merkl distributor address
    function setMerklDistributor(address _merklDistributor) external onlyGovernorOrStrategist {
        _setMerklDistributor(_merklDistributor);
    }

    /// @notice Internal logic to set the Merkl distributor
    /// @param _merklDistributor New Merkl distributor address, must be non-zero
    function _setMerklDistributor(address _merklDistributor) internal {
        require(_merklDistributor != address(0), "Invalid merklDistributor address");
        merklDistributor = IMerklDistributor(_merklDistributor);
        emit MerklDistributorUpdated(_merklDistributor);
    }

    ////////////////////////////////////////////////////
    /// --- RESCUE
    ////////////////////////////////////////////////////

    /// @notice Rescue ERC20 tokens from the contract
    /// @dev Only callable by the governor
    /// @param token Address of the token to rescue
    /// @param receiver Address to receive the tokens
    function rescueToken(address token, address receiver) external onlyGovernor {
        require(receiver != address(0), "Invalid receiver");
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(receiver, balance);
        emit TokensRescued(token, balance, receiver);
    }
}

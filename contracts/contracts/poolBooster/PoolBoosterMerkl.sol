// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IPoolBooster } from "../interfaces/poolBooster/IPoolBooster.sol";
import { IMerklDistributor } from "../interfaces/poolBooster/IMerklDistributor.sol";

interface IERC1271 {
    /**
     * @dev Should return whether the signature provided is valid for the provided data
     * @param hash Hash of the data to be signed
     * @param signature Signature byte array associated with _data
     */
    function isValidSignature(bytes32 hash, bytes memory signature)
        external
        view
        returns (bytes4 magicValue);
}

/**
 * @title Pool booster for Merkl distributor
 * @author Origin Protocol Inc
 */
contract PoolBoosterMerkl is IPoolBooster, IERC1271 {
    /// @notice address of merkl distributor
    IMerklDistributor public immutable merklDistributor;
    /// @notice address of the OS token
    IERC20 public immutable rewardToken;
    /// @notice if balance under this amount the bribe action is skipped
    uint256 public constant MIN_BRIBE_AMOUNT = 1e10;
    /// @notice Campaign duration in seconds
    uint32 public immutable duration; // -> should be immutable
    /// @notice Campaign type
    uint32 public immutable campaignType;
    /// @notice Owner of the campaign
    address public immutable creator;
    /// @notice Campaign data
    bytes public campaignData;

    constructor(
        address _rewardToken,
        address _merklDistributor,
        uint32 _duration,
        uint32 _campaignType,
        address _creator,
        bytes memory _campaignData
    ) {
        require(_rewardToken != address(0), "Invalid rewardToken address");
        require(
            _merklDistributor != address(0),
            "Invalid merklDistributor address"
        );
        require(_campaignData.length > 0, "Invalid campaignData");
        require(_duration > 1 hours, "Invalid duration");

        campaignType = _campaignType;
        duration = _duration;
        creator = _creator;

        merklDistributor = IMerklDistributor(_merklDistributor);
        rewardToken = IERC20(_rewardToken);
        campaignData = _campaignData;
    }

    /// @notice Create a campaign on the Merkl distributor
    function bribe() external override {
        // Ensure token is approved for the Merkl distributor
        uint256 minAmount = merklDistributor.rewardTokenMinAmounts(
            address(rewardToken)
        );
        require(minAmount > 0, "Min reward amount must be > 0");

        // if balance too small or below threshold, do no bribes
        uint256 balance = rewardToken.balanceOf(address(this));
        if (
            balance < MIN_BRIBE_AMOUNT ||
            (balance * 1 hours < minAmount * duration)
        ) {
            return;
        }

        // Approve the bribe contract to spend the reward token
        rewardToken.approve(address(merklDistributor), balance);

        // Notify the bribe contract of the reward amount
        merklDistributor.signAndCreateCampaign(
            IMerklDistributor.CampaignParameters({
                campaignId: bytes32(0),
                creator: creator,
                rewardToken: address(rewardToken),
                amount: balance,
                campaignType: campaignType,
                startTimestamp: getNextPeriodStartTime(),
                duration: duration,
                campaignData: campaignData
            }),
            bytes("")
        );
        emit BribeExecuted(balance);
    }

    /// @notice Used to sign a campaign on the Merkl distributor
    function isValidSignature(bytes32, bytes memory)
        external
        view
        override
        returns (bytes4 magicValue)
    {
        require(msg.sender == address(merklDistributor), "Invalid sender");
        // bytes4(keccak256("isValidSignature(bytes32,bytes)")) == 0x1626ba7e
        return bytes4(0x1626ba7e);
    }

    /// @notice Returns the timestamp for the start of the next period based on the configured duration
    function getNextPeriodStartTime() public view returns (uint32) {
        // Calculate the timestamp for the next period boundary
        return uint32((block.timestamp / duration + 1) * duration);
    }
}

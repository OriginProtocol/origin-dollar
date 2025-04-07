// SPDX-License-Identifier: MIT
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
    uint32 public immutable DURATION; // -> should be immutable
    /// @notice Campaign type
    uint32 public immutable CAMPAIGN_TYPE;
    /// @notice Merkl hash to sign (for signature verification)
    bytes32 public immutable HASH_TO_SIGN;
    bytes public campaignData;

    constructor(
        address _rewardToken,
        address _merklDistributor,
        uint32 _duration,
        uint32 _campaignType,
        bytes32 _hashToSign,
        bytes memory _campaignData
    ) {
        require(_rewardToken != address(0), "Invalid rewardToken address");
        require(
            _merklDistributor != address(0),
            "Invalid merklDistributor address"
        );
        require(_hashToSign != bytes32(0), "Invalid hashToSign address");
        require(_campaignData.length > 0, "Invalid campaignData");
        require(_duration > 1 hours, "Invalid duration");

        CAMPAIGN_TYPE = _campaignType;
        DURATION = _duration;
        HASH_TO_SIGN = _hashToSign;

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
        require(minAmount > 0, "Invalid minAmount for the reward token");

        // if balance too small or below threshhold, do no bribes
        uint256 balance = rewardToken.balanceOf(address(this));
        if (
            balance < MIN_BRIBE_AMOUNT ||
            (balance * 1 hours < minAmount * DURATION)
        ) {
            return;
        }

        // Approve the bribe contract to spend the reward token
        rewardToken.approve(address(merklDistributor), balance);

        // Notify the bribe contract of the reward amount
        merklDistributor.signAndCreateCampaign(
            IMerklDistributor.CampaignParameters({
                campaignId: bytes32(0),
                creator: address(this),
                rewardToken: address(rewardToken),
                amount: balance,
                campaignType: CAMPAIGN_TYPE,
                startTimestamp: getTomorrowRoundedTimestamp(),
                duration: DURATION,
                campaignData: campaignData
            }),
            bytes("")
        );
        emit BribeExecuted(balance);
    }

    /// @notice Used to sign a campaign on the Merkl distributor
    /// @param hash Hash of the data to be signed
    function isValidSignature(bytes32 hash, bytes memory)
        external
        view
        override
        returns (bytes4 magicValue)
    {
        // Check if the signature is valid for the given hash
        // bytes4(keccak256("isValidSignature(bytes32,bytes)")) == 0x1626ba7e
        return (hash == HASH_TO_SIGN ? bytes4(0x1626ba7e) : bytes4(0x00000000));
    }

    /// @notice Returns the current timestamp rounded to the next day
    function getTomorrowRoundedTimestamp() public view returns (uint32) {
        // Calculate the timestamp for the start of tomorrow (next midnight)
        return uint32((block.timestamp / 1 days + 1) * 1 days);
    }
}

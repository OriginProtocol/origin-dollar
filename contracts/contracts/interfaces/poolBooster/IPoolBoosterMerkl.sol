// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IPoolBooster } from "contracts/interfaces/poolBooster/IPoolBooster.sol";

interface IPoolBoosterMerkl is IPoolBooster {
    event CampaignDataUpdated(bytes newCampaignData);
    event DurationUpdated(uint32 newDuration);
    event CampaignTypeUpdated(uint32 newCampaignType);
    event RewardTokenUpdated(address newRewardToken);
    event MerklDistributorUpdated(address newMerklDistributor);
    event TokensRescued(address token, uint256 amount, address receiver);

    function initialize(
        uint32 _duration,
        uint32 _campaignType,
        address _rewardToken,
        address _merklDistributor,
        address _governor,
        address _strategist,
        bytes calldata _campaignData
    ) external;

    function VERSION() external view returns (string memory);

    function factory() external view returns (address);

    function governor() external view returns (address);

    function strategistAddr() external view returns (address);

    function merklDistributor() external view returns (address);

    function rewardToken() external view returns (address);

    function duration() external view returns (uint32);

    function campaignType() external view returns (uint32);

    function campaignData() external view returns (bytes memory);

    function MIN_BRIBE_AMOUNT() external view returns (uint256);

    function getNextPeriodStartTime() external view returns (uint32);

    function setDuration(uint32 _duration) external;

    function setCampaignType(uint32 _campaignType) external;

    function setRewardToken(address _rewardToken) external;

    function setMerklDistributor(address _merklDistributor) external;

    function setCampaignData(bytes calldata _campaignData) external;

    function rescueToken(address token, address receiver) external;
}

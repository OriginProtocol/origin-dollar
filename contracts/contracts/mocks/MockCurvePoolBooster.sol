// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

contract MockCurvePoolBooster {
    uint256 public callCount;
    uint256 public lastTotalRewardAmount;
    uint8 public lastNumberOfPeriods;
    uint256 public lastMaxRewardPerVote;
    uint256 public lastAdditionalGasLimit;
    uint256 public lastValue;

    event CampaignManaged(
        uint256 totalRewardAmount,
        uint8 numberOfPeriods,
        uint256 maxRewardPerVote,
        uint256 additionalGasLimit,
        uint256 value
    );

    function manageCampaign(
        uint256 totalRewardAmount,
        uint8 numberOfPeriods,
        uint256 maxRewardPerVote,
        uint256 additionalGasLimit
    ) external payable {
        callCount++;
        lastTotalRewardAmount = totalRewardAmount;
        lastNumberOfPeriods = numberOfPeriods;
        lastMaxRewardPerVote = maxRewardPerVote;
        lastAdditionalGasLimit = additionalGasLimit;
        lastValue = msg.value;

        emit CampaignManaged(
            totalRewardAmount,
            numberOfPeriods,
            maxRewardPerVote,
            additionalGasLimit,
            msg.value
        );
    }
}

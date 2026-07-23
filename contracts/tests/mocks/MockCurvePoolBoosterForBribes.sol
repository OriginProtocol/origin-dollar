// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

contract MockCurvePoolBoosterForBribes {
    uint256 public callCount;
    uint256 public lastTotalRewardAmount;
    uint8 public lastNumberOfPeriods;
    uint256 public lastMaxRewardPerVote;
    uint256 public lastAdditionalGasLimit;
    uint256 public lastValue;
    address public lastCaller;

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
        lastCaller = msg.sender;
    }
}

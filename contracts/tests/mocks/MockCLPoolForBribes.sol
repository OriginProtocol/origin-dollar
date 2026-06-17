// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/// @notice Combined mock for ICLPool.gauge() and ICLGauge.feesVotingReward()
///         Used by ClaimBribesSafeModule.addBribePool when _isVotingContract is false.
contract MockCLPoolForBribes {
    address public gauge;

    constructor(address _gauge) {
        gauge = _gauge;
    }
}

contract MockCLGaugeForBribes {
    address public feesVotingReward;

    constructor(address _feesVotingReward) {
        feesVotingReward = _feesVotingReward;
    }
}

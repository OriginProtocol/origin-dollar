// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockSFC {
    error ZeroAmount();
    error TransferFailed();
    error StakeIsFullySlashed();
    error NotEnoughTimePassed();

    // Mapping of delegator address to validator ID to amount delegated
    mapping(address => mapping(uint256 => uint256)) public delegations;
    // Mapping of delegator address to validator ID to withdrawal request ID to amount
    mapping(address => mapping(uint256 => mapping(uint256 => uint256))) public withdraws;
    // validator ID -> slashing refund ratio (allows to withdraw slashed stake)
    mapping(uint256 => uint256) public slashingRefundRatio;
    // Mapping of delegator address to validator ID to pending reward amount
    mapping(address => mapping(uint256 => uint256)) public rewards;
    // Flag to force withdraw to revert with a non-StakeIsFullySlashed error
    bool public forceWithdrawRevert;

    function getStake(address delegator, uint256 validatorID) external view returns (uint256) {
        return delegations[delegator][validatorID];
    }

    function delegate(uint256 validatorID) external payable {
        if (msg.value == 0) {
            revert ZeroAmount();
        }
        delegations[msg.sender][validatorID] += msg.value;
    }

    function undelegate(uint256 validatorID, uint256 wrID, uint256 amount) external {
        require(delegations[msg.sender][validatorID] >= amount, "insufficient stake");
        require(withdraws[msg.sender][validatorID][wrID] == 0, "withdrawal request already exists");

        delegations[msg.sender][validatorID] -= amount;
        withdraws[msg.sender][validatorID][wrID] = amount;
    }

    function setForceWithdrawRevert(bool _force) external {
        forceWithdrawRevert = _force;
    }

    function withdraw(uint256 validatorID, uint256 wrID) external {
        require(withdraws[msg.sender][validatorID][wrID] > 0, "no withdrawal");
        if (forceWithdrawRevert) revert NotEnoughTimePassed();

        uint256 withdrawAmount = withdraws[msg.sender][validatorID][wrID];
        uint256 penalty = (withdrawAmount * (1e18 - slashingRefundRatio[validatorID])) / 1e18;

        if (penalty >= withdrawAmount) {
            revert StakeIsFullySlashed();
        }

        (bool sent,) = msg.sender.call{value: withdrawAmount - penalty}("");
        if (!sent) {
            revert TransferFailed();
        }
    }

    function pendingRewards(address delegator, uint256 validatorID) external view returns (uint256) {
        return rewards[delegator][validatorID];
    }

    function claimRewards(uint256 validatorID) external {
        uint256 reward = rewards[msg.sender][validatorID];
        require(reward > 0, "no rewards");
        rewards[msg.sender][validatorID] = 0;
        (bool sent,) = msg.sender.call{value: reward}("");
        if (!sent) {
            revert TransferFailed();
        }
    }

    function restakeRewards(uint256 validatorID) external {
        uint256 reward = rewards[msg.sender][validatorID];
        require(reward > 0, "no rewards");
        rewards[msg.sender][validatorID] = 0;
        delegations[msg.sender][validatorID] += reward;
    }

    function setRewards(address delegator, uint256 validatorID, uint256 amount) external {
        rewards[delegator][validatorID] = amount;
    }

    /// @param refundRatio the percentage of the staked amount that can be refunded. 0.1e18 = 10%, 1e18 = 100%
    function slashValidator(uint256 validatorID, uint256 refundRatio) external {
        require(refundRatio <= 1e18, "invalid refund ratio");
        slashingRefundRatio[validatorID] = refundRatio;
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockSFC {
    error ZeroAmount();
    error TransferFailed();
    error StakeIsFullySlashed();

    // Mapping of delegator address to validator ID to amount delegated
    mapping(address => mapping(uint256 => uint256)) public delegations;
    // Mapping of delegator address to validator ID to withdrawal request ID to amount
    mapping(address => mapping(uint256 => mapping(uint256 => uint256)))
        public withdraws;
    // validator ID -> slashing refund ratio (allows to withdraw slashed stake)
    mapping(uint256 => uint256) public slashingRefundRatio;

    function getStake(address delegator, uint256 validatorID)
        external
        view
        returns (uint256)
    {
        return delegations[delegator][validatorID];
    }

    function delegate(uint256 validatorID) external payable {
        if (msg.value == 0) {
            revert ZeroAmount();
        }
        delegations[msg.sender][validatorID] += msg.value;
    }

    function undelegate(
        uint256 validatorID,
        uint256 wrID,
        uint256 amount
    ) external {
        require(
            delegations[msg.sender][validatorID] >= amount,
            "insufficient stake"
        );
        require(
            withdraws[msg.sender][validatorID][wrID] == 0,
            "withdrawal request already exists"
        );

        delegations[msg.sender][validatorID] -= amount;
        withdraws[msg.sender][validatorID][wrID] = amount;
    }

    function withdraw(uint256 validatorID, uint256 wrID) external {
        require(withdraws[msg.sender][validatorID][wrID] > 0, "no withdrawal");

        uint256 withdrawAmount = withdraws[msg.sender][validatorID][wrID];
        uint256 penalty = (withdrawAmount *
            (1e18 - slashingRefundRatio[validatorID])) / 1e18;

        if (penalty >= withdrawAmount) {
            revert StakeIsFullySlashed();
        }

        (bool sent, ) = msg.sender.call{ value: withdrawAmount - penalty }("");
        if (!sent) {
            revert TransferFailed();
        }
    }

    function pendingRewards(address delegator, uint256 validatorID)
        external
        view
        returns (uint256)
    {}

    function claimRewards(uint256 validatorID) external {}

    function restakeRewards(uint256 validatorID) external {}

    /// @param refundRatio the percentage of the staked amount that can be refunded. 0.1e18 = 10%, 1e18 = 100%
    function slashValidator(uint256 validatorID, uint256 refundRatio) external {
        require(refundRatio <= 1e18, "invalid refund ratio");
        slashingRefundRatio[validatorID] = refundRatio;
    }
}

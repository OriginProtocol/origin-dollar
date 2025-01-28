// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockSFC {
    error ZeroAmount();
    error TransferFailed();

    // Mapping of delegator address to validator ID to amount delegated
    mapping(address => mapping(uint256 => uint256)) public delegations;
    // Mapping of delegator address to validator ID to withdrawal request ID to amount
    mapping(address => mapping(uint256 => mapping(uint256 => uint256)))
        public withdraws;

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

        (bool sent, ) = msg.sender.call{
            value: withdraws[msg.sender][validatorID][wrID]
        }("");
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
}

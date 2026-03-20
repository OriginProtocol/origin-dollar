// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Address } from "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title Fee Accumulator for Native Staking SSV Strategy
 * @notice Receives execution rewards which includes tx fees and
 * MEV rewards like tx priority and tx ordering.
 * It does NOT include swept ETH from beacon chain consensus rewards or full validator withdrawals.
 * @author Origin Protocol Inc
 */
contract FeeAccumulator {
    /// @notice The address of the Native Staking Strategy
    address public immutable STRATEGY;

    event ExecutionRewardsCollected(address indexed strategy, uint256 amount);

    /**
     * @param _strategy Address of the Native Staking Strategy
     */
    constructor(address _strategy) {
        STRATEGY = _strategy;
    }

    /**
     * @notice sends all ETH in this FeeAccumulator contract to the Native Staking Strategy.
     * @return eth The amount of execution rewards that were sent to the Native Staking Strategy
     */
    function collect() external returns (uint256 eth) {
        require(msg.sender == STRATEGY, "Caller is not the Strategy");

        eth = address(this).balance;
        if (eth > 0) {
            // Send the ETH to the Native Staking Strategy
            Address.sendValue(payable(STRATEGY), eth);

            emit ExecutionRewardsCollected(STRATEGY, eth);
        }
    }

    /**
     * @dev Accept ETH
     */
    receive() external payable {}
}

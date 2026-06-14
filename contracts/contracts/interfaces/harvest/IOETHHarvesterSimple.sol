// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IOETHHarvesterSimple {
    event Harvested(
        address indexed strategy,
        address indexed rewardToken,
        uint256 amount,
        address indexed recipient
    );

    function dripper() external view returns (address);

    function harvestAndTransfer(address _strategy) external;
}

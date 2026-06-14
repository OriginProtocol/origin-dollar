// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {ICLGauge} from "contracts/interfaces/aerodrome/ICLGauge.sol";

interface IPositionManagerTransfer {
    function transferFrom(address from, address to, uint256 tokenId) external;
}

contract MockCLGauge is ICLGauge {
    address public positionManager;
    address public rewardToken;

    constructor(address _positionManager, address _rewardToken) {
        positionManager = _positionManager;
        rewardToken = _rewardToken;
    }

    function deposit(uint256 tokenId) external override {
        IPositionManagerTransfer(positionManager).transferFrom(msg.sender, address(this), tokenId);
    }

    function withdraw(uint256 tokenId) external override {
        IPositionManagerTransfer(positionManager).transferFrom(address(this), msg.sender, tokenId);
    }

    function getReward(uint256) external override {}

    function getReward(address) external override {}

    function earned(address, uint256) external pure override returns (uint256) {
        return 0;
    }

    function notifyRewardAmount(uint256) external override {}

    function notifyRewardWithoutClaim(uint256) external override {}

    function feesVotingReward() external pure override returns (address) {
        return address(0);
    }
}

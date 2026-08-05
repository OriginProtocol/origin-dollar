// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MockCurveGauge
/// @notice Simple LP staking mock for Curve gauge.
contract MockCurveGauge {
    mapping(address => uint256) public _staked;
    address public _lpToken;

    constructor(address lpToken_) {
        _lpToken = lpToken_;
    }

    function deposit(uint256 amount) external {
        IERC20(_lpToken).transferFrom(msg.sender, address(this), amount);
        _staked[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external {
        _staked[msg.sender] -= amount;
        IERC20(_lpToken).transfer(msg.sender, amount);
    }

    function balanceOf(address account) external view returns (uint256) {
        return _staked[account];
    }

    function claim_rewards() external {
        // no-op
    }

    function lp_token() external view returns (address) {
        return _lpToken;
    }
}

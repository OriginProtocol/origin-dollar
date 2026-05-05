// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockHydrexGauge
 * @notice Test-only mock implementing the subset of the IAlgebraGauge interface
 *         that StableSwapAMMStrategy and the AMO behavior suite invoke
 *         (TOKEN, balanceOf, totalSupply, deposit, withdraw, getReward,
 *         emergency, emergencyWithdraw, owner, DISTRIBUTION,
 *         notifyRewardAmount). Used by the OETHb Hydrex AMO fork-test fixture
 *         until Hydrex deploys the real GaugeV2 for the superOETHb/WETH pool.
 */
contract MockHydrexGauge {
    using SafeERC20 for IERC20;

    address public immutable TOKEN;
    address public immutable rewardToken;
    address public immutable owner;
    address public immutable DISTRIBUTION;

    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;
    bool public emergency;

    /**
     * @param _token       Pool LP token that gets staked in the gauge.
     * @param _rewardToken Reward token (HYDX in production).
     * @param _owner       Address allowed to toggle emergency mode.
     * @param _distribution Address allowed to call notifyRewardAmount.
     */
    constructor(
        address _token,
        address _rewardToken,
        address _owner,
        address _distribution
    ) {
        TOKEN = _token;
        rewardToken = _rewardToken;
        owner = _owner;
        DISTRIBUTION = _distribution;
    }

    function deposit(uint256 _amount) external {
        require(!emergency, "Gauge: emergency");
        IERC20(TOKEN).safeTransferFrom(msg.sender, address(this), _amount);
        balanceOf[msg.sender] += _amount;
        totalSupply += _amount;
    }

    function withdraw(uint256 _amount) external {
        require(!emergency, "Gauge: emergency");
        balanceOf[msg.sender] -= _amount;
        totalSupply -= _amount;
        IERC20(TOKEN).safeTransfer(msg.sender, _amount);
    }

    function emergencyWithdraw() external {
        uint256 bal = balanceOf[msg.sender];
        balanceOf[msg.sender] = 0;
        totalSupply -= bal;
        if (bal > 0) {
            IERC20(TOKEN).safeTransfer(msg.sender, bal);
        }
    }

    function getReward() external {
        uint256 bal = IERC20(rewardToken).balanceOf(address(this));
        if (bal > 0) {
            IERC20(rewardToken).safeTransfer(msg.sender, bal);
        }
    }

    function activateEmergencyMode() external {
        require(msg.sender == owner, "Gauge: not owner");
        emergency = true;
    }

    function stopEmergencyMode() external {
        require(msg.sender == owner, "Gauge: not owner");
        emergency = false;
    }

    /// @notice Matches the real IGauge.notifyRewardAmount(address,uint256)
    ///         signature so the AMO behavior suite can fund rewards.
    function notifyRewardAmount(address _token, uint256 _amount) external {
        require(msg.sender == DISTRIBUTION, "Gauge: not distribution");
        require(_token == rewardToken, "Gauge: wrong token");
        IERC20(rewardToken).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
    }
}

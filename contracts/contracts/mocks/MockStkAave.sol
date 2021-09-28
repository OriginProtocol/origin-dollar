// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./MintableERC20.sol";

contract MockStkAave is MintableERC20 {
    uint256 public COOLDOWN_SECONDS = 864000;
    uint256 public UNSTAKE_WINDOW = 172800;
    address public STAKED_TOKEN;

    mapping(address => uint256) public stakerRewardsToClaim;
    mapping(address => uint256) public stakersCooldowns;

    using SafeERC20 for IERC20;

    constructor(address _stakedToken) ERC20("Staked Aave", "stkAAVE") {
        STAKED_TOKEN = _stakedToken;
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function setStakedToken(address _stakedToken) external {
        STAKED_TOKEN = _stakedToken;
    }

    /**
     * @dev Redeems staked tokens, and stop earning rewards
     * @param to Address to redeem to
     * @param amount Amount to redeem
     **/
    function redeem(address to, uint256 amount) external {
        uint256 cooldownStartTimestamp = stakersCooldowns[msg.sender];
        uint256 windowStart = cooldownStartTimestamp + COOLDOWN_SECONDS;
        require(amount != 0, "INVALID_ZERO_AMOUNT");
        require(block.timestamp > windowStart, "INSUFFICIENT_COOLDOWN");
        require(
            block.timestamp - windowStart <= UNSTAKE_WINDOW,
            "UNSTAKE_WINDOW_FINISHED"
        );
        uint256 balanceOfMessageSender = balanceOf(msg.sender);
        uint256 amountToRedeem = (amount > balanceOfMessageSender)
            ? balanceOfMessageSender
            : amount;

        stakersCooldowns[msg.sender] = 0;
        _burn(msg.sender, amountToRedeem);
        IERC20(STAKED_TOKEN).safeTransfer(to, amountToRedeem);
    }

    /**
     * @dev Activates the cooldown period to unstake
     * - It can't be called if the user is not staking
     **/
    function cooldown() external {
        require(balanceOf(msg.sender) != 0, "INVALID_BALANCE_ON_COOLDOWN");
        stakersCooldowns[msg.sender] = block.timestamp;
    }

    /**
     * @dev Test helper function to allow changing the cooldown
     **/
    function setCooldown(address account, uint256 _cooldown) external {
        stakersCooldowns[account] = _cooldown;
    }
}

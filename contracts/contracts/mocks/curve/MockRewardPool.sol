// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IMintableERC20 } from "../MintableERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

interface IDeposit {
    function poolInfo(uint256)
        external
        view
        returns (
            address,
            address,
            address,
            address,
            address,
            bool
        );

    function rewardClaimed(
        uint256,
        address,
        uint256
    ) external;

    function withdrawTo(
        uint256,
        uint256,
        address
    ) external;
}

contract MockRewardPool {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public pid;
    address public stakingToken;
    address public rewardToken;
    address public operator;

    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => uint256) public rewards;

    constructor(
        uint256 pid_,
        address stakingToken_,
        address rewardToken_,
        address operator_
    ) public {
        pid = pid_;
        stakingToken = stakingToken_;
        rewardToken = rewardToken_;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    // mock function to set the rewards per account
    function earnRewards(address account, uint256 amount) external {
        IMintableERC20(rewardToken).mint(amount);
        rewards[account] += amount;
    }

    function stakeFor(address _for, uint256 _amount) public returns (bool) {
        require(_amount > 0, "RewardPool : Cannot stake 0");

        //give to _for
        _totalSupply = _totalSupply.add(_amount);
        _balances[_for] = _balances[_for].add(_amount);

        //take away from sender
        IERC20(stakingToken).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );

        return true;
    }

    function withdrawAndUnwrap(uint256 amount, bool claim)
        public
        returns (bool)
    {
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);

        //tell operator to withdraw from here directly to user
        IDeposit(operator).withdrawTo(pid, amount, msg.sender);

        //get rewards too
        if (claim) {
            getReward(msg.sender, true);
        }
        return true;
    }

    function withdrawAllAndUnwrap(bool claim) external {
        withdrawAndUnwrap(_balances[msg.sender], claim);
    }

    function getReward(address _account, bool _claimExtras)
        public
        returns (bool)
    {
        uint256 reward = rewards[_account];
        if (reward > 0) {
            rewards[_account] = 0;
            IERC20(rewardToken).safeTransfer(_account, reward);
            IDeposit(operator).rewardClaimed(pid, _account, reward);
        }
        return true;
    }
}

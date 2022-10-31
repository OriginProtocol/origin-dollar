// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;
import { ERC20Votes } from "openzeppelin-4.6.0/token/ERC20/extensions/ERC20Votes.sol";
import { ERC20Permit } from "openzeppelin-4.6.0/token/ERC20/extensions/draft-ERC20Permit.sol";
import { ERC20 } from "openzeppelin-4.6.0/token/ERC20/ERC20.sol";
import { PRBMathUD60x18 } from "@prb/math/contracts/PRBMathUD60x18.sol";
import { RewardsSource } from "./RewardsSource.sol";

/// @title OGV Staking
/// @author Daniel Von Fange
/// @notice Provides staking, vote power history, vote delegation, and rewards
/// distribution.
///
/// The balance received for staking (and thus the voting power and rewards
/// distribution) goes up exponentially by the end of the staked period.
contract OgvStaking is ERC20Votes {
    // 1. Core Storage
    uint256 public immutable epoch; // timestamp
    uint256 public immutable minStakeDuration; // in seconds

    // 2. Staking and Lockup Storage
    uint256 constant YEAR_BASE = 18e17;
    struct Lockup {
        uint128 amount;
        uint128 end;
        uint256 points;
    }
    mapping(address => Lockup[]) public lockups;

    // 3. Reward Storage
    ERC20 public immutable ogv; // Must not allow reentrancy
    RewardsSource public immutable rewardsSource;
    mapping(address => uint256) public rewardDebtPerShare;
    uint256 public accRewardPerShare; // As of the start of the block

    // Events
    event Stake(
        address indexed user,
        uint256 lockupId,
        uint256 amount,
        uint256 end,
        uint256 points
    );
    event Unstake(
        address indexed user,
        uint256 lockupId,
        uint256 amount,
        uint256 end,
        uint256 points
    );
    event Reward(address indexed user, uint256 amount);

    // 1. Core Functions

    constructor(
        address ogv_,
        uint256 epoch_,
        uint256 minStakeDuration_,
        address rewardsSource_
    ) ERC20("", "") ERC20Permit("veOGV") {
        ogv = ERC20(ogv_);
        epoch = epoch_;
        minStakeDuration = minStakeDuration_;
        rewardsSource = RewardsSource(rewardsSource_);
    }

    function name() public pure override returns (string memory) {
        return "Vote Escrowed Origin Dollar Governance";
    }

    function symbol() public pure override returns (string memory) {
        return "veOGV";
    }

    function transfer(address, uint256) public override returns (bool) {
        revert("Staking: Transfers disabled");
    }

    function transferFrom(
        address,
        address,
        uint256
    ) public override returns (bool) {
        revert("Staking: Transfers disabled");
    }

    // 2. Staking and Lockup Functions

    /// @notice Stake OGV to an address that may not be the same as the
    /// sender of the funds. This can be used to give staked funds to someone
    /// else.
    ///
    /// If staking before the start of staking (epoch), then the lockup start
    /// and end dates are shifted forward so that the lockup starts at the
    /// epoch.
    ///
    /// Any rewards previously earned will be paid out.
    ///
    /// @param amount OGV to lockup in the stake
    /// @param duration in seconds for the stake
    /// @param to address to receive ownership of the stake
    function stake(
        uint256 amount,
        uint256 duration,
        address to
    ) external {
        _stake(amount, duration, to);
    }

    /// @notice Stake OGV
    ///
    /// If staking before the start of staking (epoch), then the lockup start
    /// and end dates are shifted forward so that the lockup starts at the
    /// epoch.
    ///
    /// Any rewards previously earned will be paid out.
    ///
    /// @notice Stake OGV for myself.
    /// @param amount OGV to lockup in the stake
    /// @param duration in seconds for the stake
    function stake(uint256 amount, uint256 duration) external {
        _stake(amount, duration, msg.sender);
    }

    /// @dev Internal method used for public staking
    /// @param amount OGV to lockup in the stake
    /// @param duration in seconds for the stake
    /// @param to address to receive ownership of the stake
    function _stake(
        uint256 amount,
        uint256 duration,
        address to
    ) internal {
        require(to != address(0), "Staking: To the zero address");
        require(amount <= type(uint128).max, "Staking: Too much");
        require(amount > 0, "Staking: Not enough");

        // duration checked inside previewPoints
        (uint256 points, uint256 end) = previewPoints(amount, duration);
        require(
            points + totalSupply() <= type(uint192).max,
            "Staking: Max points exceeded"
        );
        _collectRewards(to);
        lockups[to].push(
            Lockup({
                amount: uint128(amount), // max checked in require above
                end: uint128(end),
                points: points
            })
        );
        _mint(to, points);
        ogv.transferFrom(msg.sender, address(this), amount); // Important that it's sender
        emit Stake(to, lockups[to].length - 1, amount, end, points);
    }

    /// @notice Collect staked OGV for a lockup and any earned rewards.
    /// @param lockupId the id of the lockup to unstake
    function unstake(uint256 lockupId) external {
        Lockup memory lockup = lockups[msg.sender][lockupId];
        uint256 amount = lockup.amount;
        uint256 end = lockup.end;
        uint256 points = lockup.points;
        require(block.timestamp >= end, "Staking: End of lockup not reached");
        require(end != 0, "Staking: Already unstaked this lockup");
        _collectRewards(msg.sender);
        delete lockups[msg.sender][lockupId]; // Keeps empty in array, so indexes are stable
        _burn(msg.sender, points);
        ogv.transfer(msg.sender, amount);
        emit Unstake(msg.sender, lockupId, amount, end, points);
    }

    /// @notice Extend a stake lockup for additional points.
    ///
    /// The stake end time is computed from the current time + duration, just
    /// like it is for new stakes. So a new stake for seven days duration and
    /// an old stake extended with a seven days duration would have the same
    /// end.
    ///
    /// If an extend is made before the start of staking, the start time for
    /// the new stake is shifted forwards to the start of staking, which also
    /// shifts forward the end date.
    ///
    /// @param lockupId the id of the old lockup to extend
    /// @param duration number of seconds from now to stake for
    function extend(uint256 lockupId, uint256 duration) external {
        // duration checked inside previewPoints
        _collectRewards(msg.sender);
        Lockup memory lockup = lockups[msg.sender][lockupId];
        uint256 oldAmount = lockup.amount;
        uint256 oldEnd = lockup.end;
        uint256 oldPoints = lockup.points;
        (uint256 newPoints, uint256 newEnd) = previewPoints(
            oldAmount,
            duration
        );
        require(newEnd > oldEnd, "Staking: New lockup must be longer");
        lockup.end = uint128(newEnd);
        lockup.points = newPoints;
        lockups[msg.sender][lockupId] = lockup;
        _mint(msg.sender, newPoints - oldPoints);
        emit Unstake(msg.sender, lockupId, oldAmount, oldEnd, oldPoints);
        emit Stake(msg.sender, lockupId, oldAmount, newEnd, newPoints);
    }

    /// @notice Preview the number of points that would be returned for the
    /// given amount and duration.
    ///
    /// @param amount OGV to be staked
    /// @param duration number of seconds to stake for
    /// @return points staking points that would be returned
    /// @return end staking period end date
    function previewPoints(uint256 amount, uint256 duration)
        public
        view
        returns (uint256, uint256)
    {
        require(duration >= minStakeDuration, "Staking: Too short");
        require(duration <= 1461 days, "Staking: Too long");
        uint256 start = block.timestamp > epoch ? block.timestamp : epoch;
        uint256 end = start + duration;
        uint256 endYearpoc = ((end - epoch) * 1e18) / 365 days;
        uint256 multiplier = PRBMathUD60x18.pow(YEAR_BASE, endYearpoc);
        return ((amount * multiplier) / 1e18, end);
    }

    // 3. Reward functions

    /// @notice Collect all earned OGV rewards.
    function collectRewards() external {
        _collectRewards(msg.sender);
    }

    /// @notice Shows the amount of OGV a user would receive if they collected
    /// rewards at this time.
    ///
    /// @param user to preview rewards for
    /// @return OGV rewards amount
    function previewRewards(address user) external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) {
            return 0; // No one has any points to even get rewards
        }
        uint256 _accRewardPerShare = accRewardPerShare;
        _accRewardPerShare += (rewardsSource.previewRewards() * 1e12) / supply;
        uint256 netRewardsPerShare = _accRewardPerShare -
            rewardDebtPerShare[user];
        return (balanceOf(user) * netRewardsPerShare) / 1e12;
    }

    /// @dev Internal function to handle rewards accounting.
    ///
    /// 1. Collect new rewards for everyone
    /// 2. Calculate this user's rewards and accounting
    /// 3. Distribute this user's rewards
    ///
    /// This function *must* be called before any user balance changes.
    ///
    /// This will always update the user's rewardDebtPerShare to match
    /// accRewardPerShare, which is essential to the accounting.
    ///
    /// @param user to collect rewards for
    function _collectRewards(address user) internal {
        uint256 supply = totalSupply();
        if (supply > 0) {
            uint256 preBalance = ogv.balanceOf(address(this));
            try rewardsSource.collectRewards() {} catch {
                // Governance staking should continue, even if rewards fail
            }
            uint256 collected = ogv.balanceOf(address(this)) - preBalance;
            accRewardPerShare += (collected * 1e12) / supply;
        }
        uint256 netRewardsPerShare = accRewardPerShare -
            rewardDebtPerShare[user];
        uint256 netRewards = (balanceOf(user) * netRewardsPerShare) / 1e12;
        rewardDebtPerShare[user] = accRewardPerShare;
        if (netRewards == 0) {
            return;
        }
        ogv.transfer(user, netRewards);
        emit Reward(user, netRewards);
    }
}

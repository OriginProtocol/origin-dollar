// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGauge {
    error NotAlive();
    error NotAuthorized();
    error NotVoter();
    error NotTeam();
    error RewardRateTooHigh();
    error ZeroAmount();
    error ZeroRewardRate();

    event Deposit(address indexed from, address indexed to, uint256 amount);
    event Withdraw(address indexed from, uint256 amount);
    event NotifyReward(address indexed from, uint256 amount);
    event ClaimFees(address indexed from, uint256 claimed0, uint256 claimed1);
    event ClaimRewards(address indexed from, uint256 amount);

    /// @notice Address of the pool LP token which is deposited (staked) for rewards
    function stakingToken() external view returns (address);

    /// @notice Address of the token (AERO) rewarded to stakers
    function rewardToken() external view returns (address);

    /// @notice Address of the FeesVotingReward contract linked to the gauge
    function feesVotingReward() external view returns (address);

    /// @notice Address of Protocol Voter
    function voter() external view returns (address);

    /// @notice Address of Protocol Voting Escrow
    function ve() external view returns (address);

    /// @notice Returns if gauge is linked to a legitimate Protocol pool
    function isPool() external view returns (bool);

    /// @notice Timestamp end of current rewards period
    function periodFinish() external view returns (uint256);

    /// @notice Current reward rate of rewardToken to distribute per second
    function rewardRate() external view returns (uint256);

    /// @notice Most recent timestamp contract has updated state
    function lastUpdateTime() external view returns (uint256);

    /// @notice Most recent stored value of rewardPerToken
    function rewardPerTokenStored() external view returns (uint256);

    /// @notice Amount of stakingToken deposited for rewards
    function totalSupply() external view returns (uint256);

    /// @notice Get the amount of stakingToken deposited by an account
    function balanceOf(address) external view returns (uint256);

    /// @notice Cached rewardPerTokenStored for an account based on their most recent action
    function userRewardPerTokenPaid(address) external view returns (uint256);

    /// @notice Cached amount of rewardToken earned for an account
    function rewards(address) external view returns (uint256);

    /// @notice View to see the rewardRate given the timestamp of the start of the epoch
    function rewardRateByEpoch(uint256) external view returns (uint256);

    /// @notice Cached amount of fees generated from the Pool linked to the Gauge of token0
    function fees0() external view returns (uint256);

    /// @notice Cached amount of fees generated from the Pool linked to the Gauge of token1
    function fees1() external view returns (uint256);

    /// @notice Get the current reward rate per unit of stakingToken deposited
    function rewardPerToken() external view returns (uint256 _rewardPerToken);

    /// @notice Returns the last time the reward was modified or periodFinish if the reward has ended
    function lastTimeRewardApplicable() external view returns (uint256 _time);

    /// @notice Returns accrued balance to date from last claim / first deposit.
    function earned(address _account) external view returns (uint256 _earned);

    /// @notice Total amount of rewardToken to distribute for the current rewards period
    function left() external view returns (uint256 _left);

    /// @notice Retrieve rewards for an address.
    /// @dev Throws if not called by same address or voter.
    /// @param _account .
    function getReward(address _account) external;

    /// @notice Deposit LP tokens into gauge for msg.sender
    /// @param _amount .
    function deposit(uint256 _amount) external;

    /// @notice Deposit LP tokens into gauge for any user
    /// @param _amount .
    /// @param _recipient Recipient to give balance to
    function deposit(uint256 _amount, address _recipient) external;

    /// @notice Withdraw LP tokens for user
    /// @param _amount .
    function withdraw(uint256 _amount) external;

    /// @dev Notifies gauge of gauge rewards. Assumes gauge reward tokens is 18 decimals.
    ///      If not 18 decimals, rewardRate may have rounding issues.
    function notifyRewardAmount(uint256 amount) external;

    /// @dev Notifies gauge of gauge rewards without distributing its fees.
    ///      Assumes gauge reward tokens is 18 decimals.
    ///      If not 18 decimals, rewardRate may have rounding issues.
    function notifyRewardWithoutClaim(uint256 amount) external;
}

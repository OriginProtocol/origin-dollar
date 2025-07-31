// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

interface ICLGauge {
    /// @notice Returns the claimable rewards for a given account and tokenId
    /// @dev Throws if account is not the position owner
    /// @dev pool.updateRewardsGrowthGlobal() needs to be called first, to return the correct claimable rewards
    /// @param account The address of the user
    /// @param tokenId The tokenId of the position
    /// @return The amount of claimable reward
    function earned(address account, uint256 tokenId)
        external
        view
        returns (uint256);

    /// @notice Retrieve rewards for all tokens owned by an account
    /// @dev Throws if not called by the voter
    /// @param account The account of the user
    function getReward(address account) external;

    /// @notice Retrieve rewards for a tokenId
    /// @dev Throws if not called by the position owner
    /// @param tokenId The tokenId of the position
    function getReward(uint256 tokenId) external;

    /// @notice Notifies gauge of gauge rewards.
    /// @param amount Amount of gauge rewards (emissions) to notify. Must be greater than 604_800.
    function notifyRewardAmount(uint256 amount) external;

    /// @dev Notifies gauge of gauge rewards without distributing its fees.
    ///      Assumes gauge reward tokens is 18 decimals.
    ///      If not 18 decimals, rewardRate may have rounding issues.
    /// @param amount Amount of gauge rewards (emissions) to notify. Must be greater than 604_800.
    function notifyRewardWithoutClaim(uint256 amount) external;

    /// @notice Used to deposit a CL position into the gauge
    /// @notice Allows the user to receive emissions instead of fees
    /// @param tokenId The tokenId of the position
    function deposit(uint256 tokenId) external;

    /// @notice Used to withdraw a CL position from the gauge
    /// @notice Allows the user to receive fees instead of emissions
    /// @notice Outstanding emissions will be collected on withdrawal
    /// @param tokenId The tokenId of the position
    function withdraw(uint256 tokenId) external;

    // /// @notice Fetch all tokenIds staked by a given account
    // /// @param depositor The address of the user
    // /// @return The tokenIds of the staked positions
    // function stakedValues(address depositor) external view returns (uint256[] memory);

    // /// @notice Fetch a staked tokenId by index
    // /// @param depositor The address of the user
    // /// @param index The index of the staked tokenId
    // /// @return The tokenId of the staked position
    // function stakedByIndex(address depositor, uint256 index) external view returns (uint256);

    // /// @notice Check whether a position is staked in the gauge by a certain user
    // /// @param depositor The address of the user
    // /// @param tokenId The tokenId of the position
    // /// @return Whether the position is staked in the gauge
    // function stakedContains(address depositor, uint256 tokenId) external view returns (bool);

    // /// @notice The amount of positions staked in the gauge by a certain user
    // /// @param depositor The address of the user
    // /// @return The amount of positions staked in the gauge
    // function stakedLength(address depositor) external view returns (uint256);

    function feesVotingReward() external view returns (address);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFraxConvexLocking {
    /* ========== EVENTS ========== */
    event LockedAdditional(
        address indexed user,
        bytes32 kek_id,
        uint256 amount
    );
    event LockedLonger(
        address indexed user,
        bytes32 kek_id,
        uint256 new_secs,
        uint256 new_start_ts,
        uint256 new_end_ts
    );
    event StakeLocked(
        address indexed user,
        uint256 amount,
        uint256 secs,
        bytes32 kek_id,
        address source_address
    );
    event WithdrawLocked(
        address indexed user,
        uint256 liquidity,
        bytes32 kek_id,
        address destination_address
    );

    // Struct for the stake
    struct LockedStake {
        bytes32 kek_id;
        uint256 start_timestamp;
        uint256 liquidity;
        uint256 ending_timestamp;
        uint256 lock_multiplier; // 6 decimals of precision. 1x = 1000000
    }

    function curvePool() external view returns (address);

    function curveToken() external view returns (address);

    function earned(address account)
        external
        view
        returns (uint256[] memory new_earned);

    function getAllRewardTokens() external view returns (address[] memory);

    function getReward(address destination_address)
        external
        returns (uint256[] memory);

    function getReward2(address destination_address, bool claim_extra_too)
        external
        returns (uint256[] memory);

    function getRewardForDuration()
        external
        view
        returns (uint256[] memory rewards_per_duration_arr);

    function lastRewardClaimTime(address) external view returns (uint256);

    function lastUpdateTime() external view returns (uint256);

    function lockAdditional(bytes32 kek_id, uint256 addl_liq) external;

    function lockLonger(bytes32 kek_id, uint256 new_ending_ts) external;

    function lockMultiplier(uint256 secs) external view returns (uint256);

    function lockedLiquidityOf(address account) external view returns (uint256);

    function lockedStakes(address, uint256)
        external
        view
        returns (
            bytes32 kek_id,
            uint256 start_timestamp,
            uint256 liquidity,
            uint256 ending_timestamp,
            uint256 lock_multiplier
        );

    function lockedStakesOf(address account)
        external
        view
        returns (LockedStake[] memory);

    function lockedStakesOfLength(address account)
        external
        view
        returns (uint256);

    function stakeLocked(uint256 liquidity, uint256 secs)
        external
        returns (bytes32);

    function withdrawLocked(
        bytes32 kek_id,
        address destination_address,
        bool claim_rewards
    ) external returns (uint256);
}

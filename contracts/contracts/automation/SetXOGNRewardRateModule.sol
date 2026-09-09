// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractSafeModule } from "./AbstractSafeModule.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IXOGN {
    function collectRewards() external;
}

interface IFixedRateRewardsSource {
    function rewardConfig()
        external
        view
        returns (uint64 lastCollect, uint192 rewardsPerSecond);

    function previewRewards() external view returns (uint256);

    function setRewardsPerSecond(uint192 rewardsPerSecond) external;
}

/**
 * @title Set xOGN Reward Rate Module
 *
 * Lets an automation account move the OGN reward rate on `FixedRateRewardsSource`
 * within bounds the Safe sets, instead of that being a manual Strategist action.
 *
 * The bounds constrain the automation key, not governance. The Safe this module
 * is enabled on is already the reward source's Strategist and can call
 * `setRewardsPerSecond` directly with no limits at all. What this buys is that a
 * compromised automation key cannot set an arbitrary rate.
 *
 * The step limit is measured against a checkpoint that refreshes at most once per
 * `stepPeriod`, not against whatever the rate happens to be at the time of the
 * call. Measuring per call would not bound anything: each successful update would
 * become the next call's baseline, so a key could walk the rate from one end of
 * [minRate, maxRate] to the other in a handful of back-to-back transactions and
 * respect the per-call limit at every step. Against a checkpoint the reachable
 * band is `maxStepBps` per period however many calls are made, which also leaves
 * a failed run free to retry inside the same period.
 */
contract SetXOGNRewardRateModule is AbstractSafeModule {
    /// @notice OGN reward source whose rate this module sets.
    address public immutable rewardsSource;

    /// @notice OGN token.
    address public immutable ogn;

    /// @notice xOGN staking contract, the reward source's `rewardsTarget`.
    address public immutable xogn;

    /// @notice Lower bound on the rate, in OGN per second.
    uint192 public minRate;

    /// @notice Upper bound on the rate, in OGN per second.
    uint192 public maxRate;

    /// @notice Largest change per period, in basis points of `checkpointRate`.
    uint16 public maxStepBps;

    /// @notice Rate the step limit is measured against for the current period.
    uint192 public checkpointRate;

    /// @notice When the current step period began.
    /// @dev Zero until the first `setRewardRate`, which self-initialises it.
    uint64 public checkpointTime;

    /// @notice Length of a step period, in seconds.
    uint32 public stepPeriod;

    /// @notice Seconds of runway the unencumbered balance must cover.
    /// @dev A backstop against a catastrophic rate, not the operating target.
    ///      The off-chain script aims at a higher figure; this only has to catch
    ///      what the script would never propose.
    uint256 public minRunway;

    event RewardRateSet(uint192 newRate, uint256 available);
    event BoundsSet(
        uint192 minRate,
        uint192 maxRate,
        uint16 maxStepBps,
        uint256 minRunway,
        uint32 stepPeriod
    );

    constructor(
        address _safeContract,
        address _operator,
        address _rewardsSource,
        address _ogn,
        address _xogn
    ) AbstractSafeModule(_safeContract) {
        require(_rewardsSource != address(0), "Invalid rewards source");
        require(_ogn != address(0), "Invalid OGN");
        require(_xogn != address(0), "Invalid xOGN");

        rewardsSource = _rewardsSource;
        ogn = _ogn;
        xogn = _xogn;

        _grantRole(OPERATOR_ROLE, _operator);
    }

    /**
     * @notice Set the reward source's emission rate.
     * @param newRate New rate in OGN per second.
     */
    function setRewardRate(uint192 newRate) external onlyOperator {
        // Settle first, in this same transaction.
        //
        // `FixedRateRewardsSource` does not pay out before changing its rate: it
        // owes `(now - lastCollect) * rewardsPerSecond`, and writing a new rate
        // reprices that whole unsettled window retroactively. Lowering the rate
        // therefore claws back rewards stakers have already earned, and raising
        // it grants rewards that were never funded.
        //
        // `collectRewards()` on xOGN is permissionless and settles the window at
        // the *old* rate. It must not be a separate transaction: two txs can be
        // separated by a reorg or a failed retry, and the window reopens in the
        // gap. Keeping it here also means no caller can skip it.
        IXOGN(xogn).collectRewards();

        (uint64 lastCollect, uint192 currentRate) = IFixedRateRewardsSource(
            rewardsSource
        ).rewardConfig();

        // Prove the settle landed, rather than assuming it.
        //
        // xOGN can skip the pull two ways, neither of which reverts here: it
        // wraps the call in try/catch so a failing reward source is swallowed,
        // and it skips the pull entirely while `totalSupply() == 0`. In either
        // case `lastCollect` is untouched and the window below stays open — and
        // `setRewardsPerSecond` would then reprice that whole window at
        // `newRate`, which is precisely what the settle exists to prevent.
        //
        // The check is exact: `FixedRateRewardsSource.collectRewards()` writes
        // `lastCollect = block.timestamp` unconditionally, so this equality
        // holds if and only if the source settled in this transaction.
        require(lastCollect == block.timestamp, "Rewards not settled");

        require(newRate >= minRate && newRate <= maxRate, "Rate out of range");
        _checkStep(newRate, currentRate);

        // Subtract what is still owed. The assertion above makes this provably
        // zero today; it is kept so `available` stays correct on its own terms
        // if that assertion is ever loosened. Do not reduce this to balanceOf()
        // on the grounds that it currently subtracts nothing: without the settle
        // the difference is routinely a third of the balance, and counting that
        // as runway would let through a rate the source cannot sustain.
        uint256 available = IERC20(ogn).balanceOf(rewardsSource) -
            IFixedRateRewardsSource(rewardsSource).previewRewards();

        // Only an increase can make runway worse, so only an increase is
        // checked. Applying this to a decrease deadlocks the automation: once
        // the source is drained `available` is zero, the step limit forbids
        // proposing anything far below the stuck rate, and every run reverts --
        // the guard blocking the one action that would relieve the condition it
        // is complaining about. Recovery would then need a Safe transaction.
        if (newRate > currentRate) {
            require(
                uint256(newRate) * minRunway <= available,
                "Runway too short"
            );
        }

        bool success = safeContract.execTransactionFromModule(
            rewardsSource,
            0, // Value
            abi.encodeWithSelector(
                IFixedRateRewardsSource.setRewardsPerSecond.selector,
                newRate
            ),
            0 // Call
        );
        require(success, "Failed to set reward rate");

        emit RewardRateSet(newRate, available);
    }

    /**
     * @notice Set the bounds this module enforces on the automation account.
     * @param _minRate Lower bound, OGN per second.
     * @param _maxRate Upper bound, OGN per second.
     * @param _maxStepBps Largest change per update, in basis points.
     * @param _minRunway Seconds of runway the unencumbered balance must cover.
     * @param _stepPeriod Seconds a step checkpoint holds before it refreshes.
     */
    function setBounds(
        uint192 _minRate,
        uint192 _maxRate,
        uint16 _maxStepBps,
        uint256 _minRunway,
        uint32 _stepPeriod
    ) external onlySafe {
        require(_minRate <= _maxRate, "Invalid rate bounds");
        require(_maxStepBps > 0 && _maxStepBps <= 1e4, "Invalid step");
        require(_minRunway > 0, "Invalid runway");
        require(_stepPeriod > 0, "Invalid step period");

        minRate = _minRate;
        maxRate = _maxRate;
        maxStepBps = _maxStepBps;
        minRunway = _minRunway;
        stepPeriod = _stepPeriod;

        emit BoundsSet(
            _minRate,
            _maxRate,
            _maxStepBps,
            _minRunway,
            _stepPeriod
        );
    }

    /// @dev Reject a jump larger than `maxStepBps` away from the period's
    ///      checkpoint. The checkpoint refreshes to the live rate on the first
    ///      call of each `stepPeriod`, so repeated calls inside one period all
    ///      measure against the same baseline and cannot compound.
    ///
    ///      Refreshing to `currentRate` rather than to the stored checkpoint is
    ///      deliberate: it picks up a rate the Safe set directly, which outranks
    ///      this module and should not be treated as drift to be corrected.
    ///
    ///      Skipped when the baseline is zero, since there is nothing to step
    ///      from and `minRate`/`maxRate` still apply.
    function _checkStep(uint192 newRate, uint192 currentRate) internal {
        uint192 baseline = checkpointRate;

        // `checkpointTime == 0` means never checkpointed. Test it explicitly
        // rather than leaning on `0 + stepPeriod` having already passed: that
        // holds on mainnet only because the epoch is far behind us, and it
        // silently skips the whole step check anywhere the clock starts near
        // zero.
        if (
            checkpointTime == 0 ||
            block.timestamp >= uint256(checkpointTime) + stepPeriod
        ) {
            baseline = currentRate;
            checkpointRate = currentRate;
            checkpointTime = uint64(block.timestamp);
        }

        if (baseline == 0) {
            return;
        }

        uint256 delta = newRate > baseline
            ? uint256(newRate) - baseline
            : uint256(baseline) - newRate;

        require(
            delta * 1e4 <= uint256(baseline) * maxStepBps,
            "Rate step too large"
        );
    }
}

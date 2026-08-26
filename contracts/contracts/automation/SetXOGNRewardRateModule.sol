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

    /// @notice Largest change per update, in basis points of the current rate.
    uint16 public maxStepBps;

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
        uint256 minRunway
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

        (, uint192 currentRate) = IFixedRateRewardsSource(rewardsSource)
            .rewardConfig();

        require(newRate >= minRate && newRate <= maxRate, "Rate out of range");
        _checkStep(newRate, currentRate);

        // Subtract what is still owed. xOGN wraps its call to the reward source
        // in try/catch, so the settle above can silently no-op and leave a real
        // liability behind. Do not reduce this to balanceOf(): the difference is
        // routinely a third of the balance, and counting it as runway would let
        // a rate through that the source cannot actually sustain.
        uint256 available = IERC20(ogn).balanceOf(rewardsSource) -
            IFixedRateRewardsSource(rewardsSource).previewRewards();
        require(uint256(newRate) * minRunway <= available, "Runway too short");

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
     */
    function setBounds(
        uint192 _minRate,
        uint192 _maxRate,
        uint16 _maxStepBps,
        uint256 _minRunway
    ) external onlySafe {
        require(_minRate <= _maxRate, "Invalid rate bounds");
        require(_maxStepBps > 0 && _maxStepBps <= 1e4, "Invalid step");
        require(_minRunway > 0, "Invalid runway");

        minRate = _minRate;
        maxRate = _maxRate;
        maxStepBps = _maxStepBps;
        minRunway = _minRunway;

        emit BoundsSet(_minRate, _maxRate, _maxStepBps, _minRunway);
    }

    /// @dev Reject a jump larger than `maxStepBps` of the current rate. Skipped
    ///      when the current rate is zero, since there is no baseline to step
    ///      from and `minRate`/`maxRate` still apply.
    function _checkStep(uint192 newRate, uint192 currentRate) internal view {
        if (currentRate == 0) {
            return;
        }

        uint256 delta = newRate > currentRate
            ? uint256(newRate) - currentRate
            : uint256(currentRate) - newRate;

        require(
            delta * 1e4 <= uint256(currentRate) * maxStepBps,
            "Rate step too large"
        );
    }
}

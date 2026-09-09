// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_SetXOGNRewardRateModule_Shared_Test
} from "tests/unit/automation/SetXOGNRewardRateModule/shared/Shared.t.sol";

// --- Project imports
import {ISetXOGNRewardRateModule} from "contracts/interfaces/automation/ISetXOGNRewardRateModule.sol";

contract Unit_Concrete_SetXOGNRewardRateModule_SetRewardRate_Test is Unit_SetXOGNRewardRateModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- SETTLE BEFORE REPRICING
    ///
    /// `FixedRateRewardsSource` reprices its whole unsettled window when the
    /// rate changes, because it does not pay out first. These tests pin the
    /// module's settle-first behaviour; they fail if the `collectRewards()`
    /// call is removed from `setRewardRate`.
    //////////////////////////////////////////////////////

    function test_setRewardRate_settlesAccruedRewardsBeforeLoweringRate() public {
        // Let 14h accrue at 1.7 OGN/s, roughly what the live contract holds
        // unsettled at any given moment.
        skip(14 hours);

        uint256 owedBefore = _owed();
        assertGt(owedBefore, 0, "nothing accrued");

        uint256 stakerBalanceBefore = ognToken.balanceOf(address(xognMock));

        // Lower the rate by the full allowed step.
        uint192 newRate = 1.275e18; // -25% from 1.7
        vm.prank(operator);
        module.setRewardRate(newRate);

        // The accrued window was paid out at the OLD rate, so stakers keep it.
        assertEq(
            ognToken.balanceOf(address(xognMock)) - stakerBalanceBefore,
            owedBefore,
            "already-earned rewards were repriced"
        );

        // And nothing is left owed from before the change.
        assertEq(_owed(), 0, "window not settled");
        assertEq(_currentRate(), newRate, "rate not applied");
    }

    function test_setRewardRate_settlesAccruedRewardsBeforeRaisingRate() public {
        skip(14 hours);

        uint256 owedBefore = _owed();
        uint256 stakerBalanceBefore = ognToken.balanceOf(address(xognMock));

        uint192 newRate = 2.125e18; // +25% from 1.7
        vm.prank(operator);
        module.setRewardRate(newRate);

        // Raising must not retroactively grant more than was actually earned.
        assertEq(
            ognToken.balanceOf(address(xognMock)) - stakerBalanceBefore, owedBefore, "unearned rewards were granted"
        );
        assertEq(_owed(), 0);
    }

    /// @dev Without the settle, this window would be repriced downward. Measures
    ///      the loss the settle prevents, so the test states the stake plainly.
    function test_setRewardRate_settleProtectsTheFullUnsettledWindow() public {
        skip(14 hours);

        uint192 oldRate = _currentRate();
        uint192 newRate = 1.275e18;
        uint256 elapsed = 14 hours;

        uint256 paidWithSettle = uint256(oldRate) * elapsed;
        uint256 paidWithoutSettle = uint256(newRate) * elapsed;
        assertGt(paidWithSettle, paidWithoutSettle, "premise wrong");

        uint256 stakerBalanceBefore = ognToken.balanceOf(address(xognMock));

        vm.prank(operator);
        module.setRewardRate(newRate);

        assertEq(
            ognToken.balanceOf(address(xognMock)) - stakerBalanceBefore,
            paidWithSettle,
            "stakers were shorted by the repricing"
        );
    }

    //////////////////////////////////////////////////////
    /// --- RUNWAY
    //////////////////////////////////////////////////////

    function test_setRewardRate_runwayIsMeasuredNetOfWhatIsOwed() public {
        // Fund the source so that the raw balance would pass the runway check
        // but the balance net of what is owed would not.
        uint192 newRate = 2e18;
        uint256 target = uint256(newRate) * MIN_RUNWAY;

        // Drain to exactly the runway requirement, then let a window accrue so
        // part of that balance is already spoken for.
        uint256 balance = ognToken.balanceOf(address(rewardsSource));
        vm.prank(address(rewardsSource));
        ognToken.transfer(address(0xdead), balance - target);
        assertEq(ognToken.balanceOf(address(rewardsSource)), target);

        skip(1 hours);
        assertGt(_owed(), 0, "nothing owed");

        // Raw balance == target, so a balanceOf()-based check would pass here.
        // Net of what is owed it does not, and the settle pays that out first.
        vm.prank(operator);
        vm.expectRevert("Runway too short");
        module.setRewardRate(newRate);
    }

    /// @dev Must propose an *increase*: the runway floor only applies upward,
    ///      so 1.5e18 (a cut from 1.7) would sail through and the test would
    ///      pass without exercising the guard it is named for.
    function test_setRewardRate_RevertWhen_runwayTooShort() public {
        uint256 balance = ognToken.balanceOf(address(rewardsSource));
        vm.prank(address(rewardsSource));
        ognToken.transfer(address(0xdead), balance - 1e18);

        vm.prank(operator);
        vm.expectRevert("Runway too short");
        module.setRewardRate(2e18);
    }

    /// @dev The unwedge. A cut can only improve runway, so refusing it when
    ///      runway is short blocks the sole escape from a drained source. The
    ///      old guard applied unconditionally and reverted here.
    function test_setRewardRate_allowsDecreaseWhenRunwayIsShort() public {
        uint256 balance = ognToken.balanceOf(address(rewardsSource));
        vm.prank(address(rewardsSource));
        ognToken.transfer(address(0xdead), balance - 1e18);

        // Far below what MIN_RUNWAY would demand of any rate at this balance.
        assertLt(ognToken.balanceOf(address(rewardsSource)), MIN_RATE * MIN_RUNWAY);

        uint192 lower = uint192((uint256(INITIAL_RATE) * (1e4 - MAX_STEP_BPS)) / 1e4);
        vm.prank(operator);
        module.setRewardRate(lower);

        assertEq(_currentRate(), lower);
    }

    /// @dev The full F-1 wedge: source drained at a rate inflow cannot sustain.
    ///      The step limit caps how far each run may cut, so recovery has to be
    ///      a walk rather than one jump -- what matters is that every step lands
    ///      instead of reverting, so the controller heals without a Safe tx.
    function test_setRewardRate_wedgeScenarioRecovers() public {
        uint256 balance = ognToken.balanceOf(address(rewardsSource));
        vm.prank(address(rewardsSource));
        ognToken.transfer(address(0xdead), balance);

        assertEq(ognToken.balanceOf(address(rewardsSource)), 0, "source must be dry");

        uint192 rate = INITIAL_RATE;
        for (uint256 i = 0; i < 4; ++i) {
            rate = uint192((uint256(rate) * (1e4 - MAX_STEP_BPS)) / 1e4);
            vm.prank(operator);
            module.setRewardRate(rate);
            assertEq(_currentRate(), rate);
            skip(STEP_PERIOD);
        }

        assertLt(_currentRate(), INITIAL_RATE);
    }

    /// @dev xOGN swallows a failing reward-source collect. If the module went
    ///      ahead anyway, `setRewardsPerSecond` would reprice the still-open
    ///      window at the new rate -- the exact loss the settle exists to stop.
    ///      So it must refuse to proceed rather than merely price around it.
    function test_setRewardRate_RevertWhen_settleSilentlyNoops() public {
        xognMock.setCollectReverts(true);

        skip(1 hours);
        assertGt(_owed(), 0, "test needs an open window to protect");

        vm.prank(operator);
        vm.expectRevert("Rewards not settled");
        module.setRewardRate(2e18);
    }

    /// @dev The second silent path: `ExponentialStaking._collectRewards` skips
    ///      the pull entirely while `totalSupply() == 0`. Nothing reverts, so a
    ///      try/catch would not see it -- only `lastCollect` reveals it.
    function test_setRewardRate_RevertWhen_settleSkippedForZeroSupply() public {
        xognMock.setSupplyIsZero(true);

        skip(1 hours);
        assertGt(_owed(), 0, "test needs an open window to protect");

        vm.prank(operator);
        vm.expectRevert("Rewards not settled");
        module.setRewardRate(2e18);
    }

    //////////////////////////////////////////////////////
    /// --- BOUNDS
    //////////////////////////////////////////////////////

    function test_setRewardRate_acceptsRateAtBounds() public {
        // Walk down to MIN_RATE in allowed steps. Each step needs its own period:
        // the checkpoint only refreshes once per `stepPeriod`, so without the
        // skip the second call would still be measured against INITIAL_RATE.
        uint192 rate = INITIAL_RATE;
        while (rate > MIN_RATE) {
            uint192 next = uint192((uint256(rate) * (1e4 - MAX_STEP_BPS)) / 1e4);
            if (next < MIN_RATE) next = MIN_RATE;
            vm.prank(operator);
            module.setRewardRate(next);
            rate = next;
            _skipStepPeriod();
        }
        assertEq(_currentRate(), MIN_RATE);
    }

    function test_setRewardRate_RevertWhen_belowMinRate() public {
        vm.prank(address(mockSafe));
        module.setBounds(MIN_RATE, MAX_RATE, 1e4, MIN_RUNWAY, STEP_PERIOD);

        vm.prank(operator);
        vm.expectRevert("Rate out of range");
        module.setRewardRate(MIN_RATE - 1);
    }

    function test_setRewardRate_RevertWhen_aboveMaxRate() public {
        vm.prank(address(mockSafe));
        module.setBounds(MIN_RATE, MAX_RATE, 1e4, MIN_RUNWAY, STEP_PERIOD);

        vm.prank(operator);
        vm.expectRevert("Rate out of range");
        module.setRewardRate(MAX_RATE + 1);
    }

    function test_setRewardRate_RevertWhen_stepTooLarge() public {
        // 1.7 -> 1.2 is a 29.4% cut, past the 25% step limit.
        vm.prank(operator);
        vm.expectRevert("Rate step too large");
        module.setRewardRate(1.2e18);
    }

    function test_setRewardRate_allowsExactMaxStep() public {
        uint192 newRate = uint192((uint256(INITIAL_RATE) * (1e4 - MAX_STEP_BPS)) / 1e4);

        vm.prank(operator);
        module.setRewardRate(newRate);

        assertEq(_currentRate(), newRate);
    }

    /// @dev The finding this checkpoint exists for. Measured per call, each
    ///      update becomes the next one's baseline, so 25% steps compound and
    ///      the operator walks 1.7 -> 5 OGN/s in six back-to-back transactions
    ///      while every individual step looks legal. Against a checkpoint the
    ///      second call in the same period is already too far.
    function test_setRewardRate_RevertWhen_ratchetingWithinOnePeriod() public {
        uint192 first = uint192((uint256(INITIAL_RATE) * (1e4 + MAX_STEP_BPS)) / 1e4);

        vm.prank(operator);
        module.setRewardRate(first);
        assertEq(_currentRate(), first);

        // Legal against the new live rate, but not against the checkpoint.
        uint192 second = uint192((uint256(first) * (1e4 + MAX_STEP_BPS)) / 1e4);

        vm.prank(operator);
        vm.expectRevert("Rate step too large");
        module.setRewardRate(second);
    }

    /// @dev The limit is per period, not per lifetime: once the period rolls the
    ///      checkpoint refreshes and the next 25% is allowed.
    function test_setRewardRate_allowsStepAfterPeriodElapses() public {
        uint192 first = uint192((uint256(INITIAL_RATE) * (1e4 + MAX_STEP_BPS)) / 1e4);

        vm.prank(operator);
        module.setRewardRate(first);

        _skipStepPeriod();

        uint192 second = uint192((uint256(first) * (1e4 + MAX_STEP_BPS)) / 1e4);
        vm.prank(operator);
        module.setRewardRate(second);

        assertEq(_currentRate(), second);
        assertEq(uint256(module.checkpointRate()), first, "checkpoint should refresh to the live rate");
    }

    /// @dev A retry inside the same period is still allowed -- it just cannot
    ///      travel further from the checkpoint. This is why the fix is a
    ///      checkpoint rather than a plain cooldown.
    function test_setRewardRate_allowsRetryWithinPeriodInsideTheBand() public {
        uint192 first = uint192((uint256(INITIAL_RATE) * (1e4 + 1000)) / 1e4);

        vm.prank(operator);
        module.setRewardRate(first);

        // Still within 25% of the checkpoint, so a same-period correction lands.
        uint192 second = uint192((uint256(INITIAL_RATE) * (1e4 + 2000)) / 1e4);
        vm.prank(operator);
        module.setRewardRate(second);

        assertEq(_currentRate(), second);
    }

    /// @dev The Safe is the reward source's Strategist and outranks this module.
    ///      A rate it sets directly becomes the next period's baseline rather
    ///      than drift the module tries to correct.
    function test_setRewardRate_checkpointRefreshesToARateTheSafeSetDirectly() public {
        uint192 safeRate = 3e18;
        rewardsSource.setRewardsPerSecond(safeRate);

        _skipStepPeriod();

        // A 25% step from 3.0 -- far outside 25% of the original 1.7.
        uint192 stepped = uint192((uint256(safeRate) * (1e4 + MAX_STEP_BPS)) / 1e4);
        vm.prank(operator);
        module.setRewardRate(stepped);

        assertEq(_currentRate(), stepped);
        assertEq(uint256(module.checkpointRate()), safeRate);
    }

    function test_setRewardRate_skipsStepCheckWhenCurrentRateIsZero() public {
        rewardsSource.setRewardsPerSecond(0);

        // No baseline to step from; min/max still apply.
        vm.prank(operator);
        module.setRewardRate(MAX_RATE);

        assertEq(_currentRate(), MAX_RATE);
    }

    //////////////////////////////////////////////////////
    /// --- ACCESS CONTROL & PLUMBING
    //////////////////////////////////////////////////////

    function test_setRewardRate_RevertWhen_notOperator() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not an operator");
        module.setRewardRate(1.5e18);
    }

    function test_setRewardRate_RevertWhen_safeExecFails() public {
        mockSafe.setShouldFail(true);

        vm.prank(operator);
        vm.expectRevert("Failed to set reward rate");
        module.setRewardRate(1.5e18);
    }

    function test_setRewardRate_emitsEvent() public {
        uint192 newRate = 1.5e18;

        vm.expectEmit({emitter: address(module)});
        emit ISetXOGNRewardRateModule.RewardRateSet(newRate, SOURCE_FUNDING);

        vm.prank(operator);
        module.setRewardRate(newRate);
    }
}

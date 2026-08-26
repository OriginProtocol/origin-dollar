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

    function test_setRewardRate_RevertWhen_runwayTooShort() public {
        uint256 balance = ognToken.balanceOf(address(rewardsSource));
        vm.prank(address(rewardsSource));
        ognToken.transfer(address(0xdead), balance - 1e18);

        vm.prank(operator);
        vm.expectRevert("Runway too short");
        module.setRewardRate(1.5e18);
    }

    /// @dev xOGN swallows a failing reward-source collect, so the module must
    ///      still discount what is owed rather than trusting the settle.
    function test_setRewardRate_runwayHoldsWhenSettleSilentlyNoops() public {
        xognMock.setCollectReverts(true);

        uint192 newRate = 2e18;
        uint256 target = uint256(newRate) * MIN_RUNWAY;

        uint256 balance = ognToken.balanceOf(address(rewardsSource));
        vm.prank(address(rewardsSource));
        ognToken.transfer(address(0xdead), balance - target);

        skip(1 hours);

        vm.prank(operator);
        vm.expectRevert("Runway too short");
        module.setRewardRate(newRate);
    }

    //////////////////////////////////////////////////////
    /// --- BOUNDS
    //////////////////////////////////////////////////////

    function test_setRewardRate_acceptsRateAtBounds() public {
        // Walk down to MIN_RATE in allowed steps.
        uint192 rate = INITIAL_RATE;
        while (rate > MIN_RATE) {
            uint192 next = uint192((uint256(rate) * (1e4 - MAX_STEP_BPS)) / 1e4);
            if (next < MIN_RATE) next = MIN_RATE;
            vm.prank(operator);
            module.setRewardRate(next);
            rate = next;
        }
        assertEq(_currentRate(), MIN_RATE);
    }

    function test_setRewardRate_RevertWhen_belowMinRate() public {
        vm.prank(address(mockSafe));
        module.setBounds(MIN_RATE, MAX_RATE, 1e4, MIN_RUNWAY);

        vm.prank(operator);
        vm.expectRevert("Rate out of range");
        module.setRewardRate(MIN_RATE - 1);
    }

    function test_setRewardRate_RevertWhen_aboveMaxRate() public {
        vm.prank(address(mockSafe));
        module.setBounds(MIN_RATE, MAX_RATE, 1e4, MIN_RUNWAY);

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

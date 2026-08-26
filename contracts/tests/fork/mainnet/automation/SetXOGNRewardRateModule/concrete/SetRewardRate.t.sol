// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Fork_SetXOGNRewardRateModule_Shared_Test,
    IRewardsSourceView,
    ISafeModules
} from "tests/fork/mainnet/automation/SetXOGNRewardRateModule/shared/Shared.t.sol";

// --- Test utilities
import {Mainnet, CrossChain} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Fork_Concrete_SetXOGNRewardRateModule_SetRewardRate_Test is Fork_SetXOGNRewardRateModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- WIRING
    //////////////////////////////////////////////////////

    function test_setUp_moduleIsEnabledOnTheGuardianSafe() public view {
        assertTrue(ISafeModules(CrossChain.multichainStrategist).isModuleEnabled(address(module)), "module not enabled");
    }

    /// @dev The module reaches the reward source through the Safe, so the Safe has to
    ///      be the reward source's strategist. If that is ever re-pointed, every rate
    ///      update silently starts reverting.
    function test_setUp_guardianIsTheRewardSourceStrategist() public view {
        assertEq(
            IRewardsSourceView(Mainnet.OGNRewardsSource).strategistAddr(),
            CrossChain.multichainStrategist,
            "Guardian is not the strategist"
        );
    }

    /// @dev The settle-first call goes through xOGN, which must be the reward source's
    ///      target for it to settle anything.
    function test_setUp_xOGNIsTheRewardsTarget() public view {
        assertEq(
            IRewardsSourceView(Mainnet.OGNRewardsSource).rewardsTarget(), Mainnet.xOGN, "xOGN is not the rewards target"
        );
    }

    //////////////////////////////////////////////////////
    /// --- SETTLE BEFORE REPRICING, AGAINST REAL CONTRACTS
    //////////////////////////////////////////////////////

    /// @dev The claim under test: the deployed FixedRateRewardsSource reprices its
    ///      unsettled window when the rate changes, and the module's settle-first call
    ///      is what stops that. Asserted here against the real deployment, so it does
    ///      not rest on our mock being a faithful copy.
    function test_setRewardRate_realSourceRepricesWithoutASettle() public {
        skip(12 hours);

        uint256 owedBefore = _owed();
        assertGt(owedBefore, 0, "nothing accrued on the real source");

        uint192 oldRate = _currentRate();
        uint192 newRate = uint192((uint256(oldRate) * 8000) / 1e4); // -20%

        // Take a snapshot, change the rate WITHOUT settling (straight from the Safe,
        // the way a manual Strategist action would), and observe the repricing.
        uint256 snap = vm.snapshotState();

        vm.prank(CrossChain.multichainStrategist);
        (bool ok,) = Mainnet.OGNRewardsSource.call(abi.encodeWithSignature("setRewardsPerSecond(uint192)", newRate));
        assertTrue(ok, "direct rate change failed");

        uint256 owedAfterUnsettledChange = _owed();
        assertLt(owedAfterUnsettledChange, owedBefore, "premise wrong: the real source did not reprice");

        vm.revertToState(snap);

        // Now the same move through the module, which settles first.
        uint256 xognBefore = IERC20(Mainnet.OGN).balanceOf(Mainnet.xOGN);

        vm.prank(CrossChain.talosRelayer);
        module.setRewardRate(newRate);

        uint256 collected = IERC20(Mainnet.OGN).balanceOf(Mainnet.xOGN) - xognBefore;

        assertEq(collected, owedBefore, "the accrued window was not paid at the old rate");
        assertEq(_currentRate(), newRate, "rate not applied");
        assertEq(_owed(), 0, "window left unsettled");
    }

    function test_setRewardRate_settlesBeforeRaisingRate() public {
        skip(6 hours);

        uint256 owedBefore = _owed();
        uint192 newRate = uint192((uint256(_currentRate()) * 11000) / 1e4); // +10%

        uint256 xognBefore = IERC20(Mainnet.OGN).balanceOf(Mainnet.xOGN);

        vm.prank(CrossChain.talosRelayer);
        module.setRewardRate(newRate);

        assertEq(IERC20(Mainnet.OGN).balanceOf(Mainnet.xOGN) - xognBefore, owedBefore, "unearned rewards granted");
        assertEq(_currentRate(), newRate);
    }

    //////////////////////////////////////////////////////
    /// --- BOUNDS, AGAINST REAL STATE
    //////////////////////////////////////////////////////

    function test_setRewardRate_RevertWhen_stepTooLarge() public {
        uint192 tooLow = uint192((uint256(_currentRate()) * 5000) / 1e4); // -50%

        vm.prank(CrossChain.talosRelayer);
        vm.expectRevert("Rate step too large");
        module.setRewardRate(tooLow);
    }

    function test_setRewardRate_RevertWhen_notOperator() public {
        // Read before the prank: _currentRate() makes an external call, which would
        // consume the prank and leave setRewardRate unpranked.
        uint192 rate = _currentRate();

        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        module.setRewardRate(rate);
    }

    /// @dev The reward source runs a thin buffer, so the runway floor is close to
    ///      binding in normal operation. Pin how much headroom actually exists.
    function test_setRewardRate_runwayFloorIsSatisfiedAtCurrentRate() public {
        uint256 balance = IERC20(Mainnet.OGN).balanceOf(Mainnet.OGNRewardsSource);
        uint256 available = balance - _owed();
        uint192 rate = _currentRate();

        emit log_named_decimal_uint("source balance (OGN)", balance, 18);
        emit log_named_decimal_uint("already owed  (OGN)", _owed(), 18);
        emit log_named_decimal_uint("available     (OGN)", available, 18);
        emit log_named_uint("runway at current rate (hours)", available / rate / 1 hours);

        assertGe(available, uint256(rate) * MIN_RUNWAY, "live runway is already below the module's floor");
    }
}

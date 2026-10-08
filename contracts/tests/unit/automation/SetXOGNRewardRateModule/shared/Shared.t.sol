// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";

// --- External libraries
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

// --- Project imports
import {ISetXOGNRewardRateModule} from "contracts/interfaces/automation/ISetXOGNRewardRateModule.sol";
import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {MockXOGN} from "tests/mocks/MockXOGN.sol";
import {MockFixedRateRewardsSource} from "tests/mocks/MockFixedRateRewardsSource.sol";

abstract contract Unit_SetXOGNRewardRateModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////

    MockSafeContract internal mockSafe;
    ISetXOGNRewardRateModule internal module;
    MockERC20 internal ognToken;
    MockXOGN internal xognMock;
    MockFixedRateRewardsSource internal rewardsSource;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    /// @dev Mirrors the live rate at the time of writing (1.7 OGN/s).
    uint192 internal constant INITIAL_RATE = 1.7e18;

    uint192 internal constant MIN_RATE = 0.25e18;
    uint192 internal constant MAX_RATE = 5e18;
    uint16 internal constant MAX_STEP_BPS = 2500;
    uint256 internal constant MIN_RUNWAY = 12 hours;

    /// @dev Matches the weekly schedule, so a normal run always opens a fresh
    ///      step period and the limit behaves as if it were per call.
    uint32 internal constant STEP_PERIOD = 7 days;

    /// @dev Enough OGN to satisfy MIN_RUNWAY at MAX_RATE, so runway is never the
    ///      binding constraint unless a test makes it so.
    uint256 internal constant SOURCE_FUNDING = 1_000_000e18;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployContracts();
        label();
    }

    function _deployContracts() internal {
        mockSafe = new MockSafeContract();

        ognToken = new MockERC20("OGN", "OGN", 18);

        rewardsSource = new MockFixedRateRewardsSource(address(ognToken));
        xognMock = new MockXOGN(address(ognToken));

        rewardsSource.setRewardsTarget(address(xognMock));
        xognMock.setRewardsSource(address(rewardsSource));

        ognToken.mint(address(rewardsSource), SOURCE_FUNDING);
        rewardsSource.setRewardsPerSecond(INITIAL_RATE);

        module = ISetXOGNRewardRateModule(
            vm.deployCode(
                Automation.SET_XOGN_REWARD_RATE_MODULE,
                abi.encode(address(mockSafe), operator, address(rewardsSource), address(ognToken), address(xognMock))
            )
        );

        vm.prank(address(mockSafe));
        module.setBounds(MIN_RATE, MAX_RATE, MAX_STEP_BPS, MIN_RUNWAY, STEP_PERIOD);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Advance a whole step period and top the source back up. A period of
    ///      emissions drains more than the source holds at setup, so without the
    ///      refill every period-crossing test would trip the runway check for
    ///      reasons unrelated to what it is testing.
    ///
    ///      The target covers a full period paid at MAX_RATE plus the runway
    ///      floor that has to survive it, which is the worst case any of these
    ///      tests can reach.
    function _skipStepPeriod() internal {
        skip(STEP_PERIOD);

        uint256 target = uint256(MAX_RATE) * STEP_PERIOD + uint256(MAX_RATE) * MIN_RUNWAY;
        uint256 balance = ognToken.balanceOf(address(rewardsSource));
        if (balance < target) {
            ognToken.mint(address(rewardsSource), target - balance);
        }
    }

    /// @dev OGN the reward source owes stakers but has not paid out yet.
    function _owed() internal view returns (uint256) {
        return rewardsSource.previewRewards();
    }

    function _currentRate() internal view returns (uint192 rate) {
        (, rate) = rewardsSource.rewardConfig();
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(address(mockSafe), "MockSafe");
        vm.label(address(ognToken), "OGN");
        vm.label(address(xognMock), "xOGN");
        vm.label(address(rewardsSource), "RewardsSource");
        vm.label(address(module), "SetXOGNRewardRateModule");
    }
}

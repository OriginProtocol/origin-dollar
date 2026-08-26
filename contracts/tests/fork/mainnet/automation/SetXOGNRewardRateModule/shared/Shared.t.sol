// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";
import {Mainnet, CrossChain} from "tests/utils/Addresses.sol";

// --- Project imports
import {ISetXOGNRewardRateModule} from "contracts/interfaces/automation/ISetXOGNRewardRateModule.sol";

interface ISafeModules {
    function enableModule(address module) external;
    function isModuleEnabled(address module) external view returns (bool);
}

interface IRewardsSourceView {
    function rewardConfig() external view returns (uint64 lastCollect, uint192 rewardsPerSecond);
    function previewRewards() external view returns (uint256);
    function strategistAddr() external view returns (address);
    function rewardsTarget() external view returns (address);
}

/// @notice Fork base exercising the module against the deployed FixedRateRewardsSource
///         and ExponentialStaking rather than mocks.
/// @dev The unit tests pin the same behaviour against MockFixedRateRewardsSource. These
///      exist because that mock encodes our reading of production, and a mock that is
///      wrong in the same direction as the contract would let a real bug through. Here
///      the reward source, xOGN and Guardian Safe are all the real deployments.
abstract contract Fork_SetXOGNRewardRateModule_Shared_Test is BaseFork {
    ISetXOGNRewardRateModule internal module;

    uint192 internal constant MIN_RATE = 0.25e18;
    uint192 internal constant MAX_RATE = 5e18;
    uint16 internal constant MAX_STEP_BPS = 2500;
    uint256 internal constant MIN_RUNWAY = 12 hours;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();
        _deployAndEnableModule();
        _label();
    }

    function _deployAndEnableModule() internal {
        module = ISetXOGNRewardRateModule(
            vm.deployCode(
                Automation.SET_XOGN_REWARD_RATE_MODULE,
                abi.encode(
                    CrossChain.multichainStrategist,
                    CrossChain.talosRelayer,
                    Mainnet.OGNRewardsSource,
                    Mainnet.OGN,
                    Mainnet.xOGN
                )
            )
        );

        // A Safe enables a module by calling itself.
        vm.prank(CrossChain.multichainStrategist);
        ISafeModules(CrossChain.multichainStrategist).enableModule(address(module));

        vm.prank(CrossChain.multichainStrategist);
        module.setBounds(MIN_RATE, MAX_RATE, MAX_STEP_BPS, MIN_RUNWAY);
    }

    function _currentRate() internal view returns (uint192 rate) {
        (, rate) = IRewardsSourceView(Mainnet.OGNRewardsSource).rewardConfig();
    }

    function _owed() internal view returns (uint256) {
        return IRewardsSourceView(Mainnet.OGNRewardsSource).previewRewards();
    }

    function _label() internal {
        vm.label(address(module), "SetXOGNRewardRateModule");
        vm.label(Mainnet.OGNRewardsSource, "OGNRewardsSource");
        vm.label(Mainnet.xOGN, "xOGN");
        vm.label(CrossChain.multichainStrategist, "GuardianSafe");
    }
}

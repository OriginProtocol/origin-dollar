// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";

import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";
import {IClaimStrategyRewardsSafeModule} from "contracts/interfaces/automation/IClaimStrategyRewardsSafeModule.sol";

abstract contract Unit_ClaimStrategyRewardsSafeModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////

    MockSafeContract internal mockSafe;
    IClaimStrategyRewardsSafeModule internal claimStrategyRewardsModule;
    address internal strategyA;
    address internal strategyB;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployContracts();
        label();
    }

    function _deployContracts() internal {
        // Deploy mock safe
        mockSafe = new MockSafeContract();

        // Deploy mock strategies
        MockStrategy _strategyA = new MockStrategy();
        MockStrategy _strategyB = new MockStrategy();
        strategyA = address(_strategyA);
        strategyB = address(_strategyB);

        // Deploy ClaimStrategyRewardsSafeModule with initial strategies
        address[] memory initialStrategies = new address[](2);
        initialStrategies[0] = strategyA;
        initialStrategies[1] = strategyB;

        claimStrategyRewardsModule = IClaimStrategyRewardsSafeModule(
            vm.deployCode(
                Automation.CLAIM_STRATEGY_REWARDS_SAFE_MODULE,
                abi.encode(address(mockSafe), operator, initialStrategies)
            )
        );
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(address(mockSafe), "MockSafe");
        vm.label(strategyA, "StrategyA");
        vm.label(strategyB, "StrategyB");
        vm.label(address(claimStrategyRewardsModule), "ClaimStrategyRewardsModule");
    }
}

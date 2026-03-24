// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";
import {ClaimStrategyRewardsSafeModule} from "contracts/automation/ClaimStrategyRewardsSafeModule.sol";

abstract contract Unit_ClaimStrategyRewardsSafeModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////

    MockSafeContract internal mockSafe;
    ClaimStrategyRewardsSafeModule internal claimStrategyRewardsModule;
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

        claimStrategyRewardsModule = new ClaimStrategyRewardsSafeModule(address(mockSafe), operator, initialStrategies);
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

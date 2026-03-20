// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Fork_NativeStakingSSVStrategy_Shared_Test
} from "tests/fork/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";
import {Cluster} from "contracts/interfaces/ISSVNetwork.sol";
import {ValidatorRegistrator} from "contracts/strategies/NativeStaking/ValidatorRegistrator.sol";
import {ValidatorStakeData} from "contracts/strategies/NativeStaking/ValidatorRegistrator.sol";

contract Fork_Concrete_NativeStakingSSVStrategy_ValidatorExit_Test is Fork_NativeStakingSSVStrategy_Shared_Test {
    function setUp() public override {
        super.setUp();

        _resetStakeETHTally();

        // Skip if strategy is full
        if (nativeStakingSSVStrategy.activeDepositedValidators() >= 500) return;
    }

    /// @dev Test exiting and removing a staked validator
    function test_exitAndRemoveValidator() public {
        _depositToStrategy(32 ether);

        // Register and stake, get the updated cluster
        Cluster memory updatedCluster = _registerAndStakeEth();

        uint64[] memory operatorIds = _getTestOperatorIds();
        bytes32 pubKeyHash = keccak256(TEST_VALIDATOR_PUBKEY);

        // Exit validator from SSV network
        vm.prank(validatorRegistratorAddr);
        vm.expectEmit(true, true, true, true, address(nativeStakingSSVStrategy));
        emit ValidatorRegistrator.SSVValidatorExitInitiated(pubKeyHash, TEST_VALIDATOR_PUBKEY, operatorIds);
        nativeStakingSSVStrategy.exitSsvValidator(TEST_VALIDATOR_PUBKEY, operatorIds);

        // Remove validator from SSV network
        vm.prank(validatorRegistratorAddr);
        vm.expectEmit(true, true, true, true, address(nativeStakingSSVStrategy));
        emit ValidatorRegistrator.SSVValidatorExitCompleted(pubKeyHash, TEST_VALIDATOR_PUBKEY, operatorIds);
        nativeStakingSSVStrategy.removeSsvValidator(TEST_VALIDATOR_PUBKEY, operatorIds, updatedCluster);
    }

    /// @dev Test removing a registered (but not staked) validator
    function test_removeRegisteredValidator() public {
        _depositToStrategy(32 ether);

        // Deal SSV tokens and get cluster
        deal(address(ssv), address(nativeStakingSSVStrategy), 1_000 ether);
        Cluster memory cluster = _getCluster();

        // Build arrays for registration
        bytes[] memory pubkeys = new bytes[](1);
        pubkeys[0] = TEST_VALIDATOR_PUBKEY;
        bytes[] memory sharesData = new bytes[](1);
        sharesData[0] = TEST_SHARES_DATA;
        uint64[] memory operatorIds = _getTestOperatorIds();

        // Record logs to capture updated cluster
        vm.recordLogs();

        // Register only (no stake)
        vm.prank(validatorRegistratorAddr);
        nativeStakingSSVStrategy.registerSsvValidators(pubkeys, operatorIds, sharesData, cluster);

        Cluster memory updatedCluster = _extractClusterFromLogs();

        bytes32 pubKeyHash = keccak256(TEST_VALIDATOR_PUBKEY);

        // Remove the registered validator directly (without staking)
        vm.prank(validatorRegistratorAddr);
        vm.expectEmit(true, true, true, true, address(nativeStakingSSVStrategy));
        emit ValidatorRegistrator.SSVValidatorExitCompleted(pubKeyHash, TEST_VALIDATOR_PUBKEY, operatorIds);
        nativeStakingSSVStrategy.removeSsvValidator(TEST_VALIDATOR_PUBKEY, operatorIds, updatedCluster);
    }
}

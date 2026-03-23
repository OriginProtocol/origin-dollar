// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Fork_NativeStakingSSVStrategy_Shared_Test
} from "tests/fork/mainnet/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";
import {Cluster} from "contracts/interfaces/ISSVNetwork.sol";
import {Vm} from "forge-std/Vm.sol";

contract Fork_Concrete_NativeStakingSSVStrategy_ValidatorRegistration_Test is
    Fork_NativeStakingSSVStrategy_Shared_Test
{
    function setUp() public override {
        super.setUp();

        _resetStakeETHTally();

        // Skip if strategy is full
        if (nativeStakingSSVStrategy.activeDepositedValidators() >= 500) return;
    }

    /// @dev Test registering and staking 32 ETH for a validator
    function test_registerAndStakeValidator() public {
        _depositToStrategy(32 ether);
        _registerAndStakeEth();
    }

    /// @dev Test that registering the same validator twice reverts
    function test_registerSsvValidators_RevertWhen_alreadyRegistered() public {
        _depositToStrategy(32 ether);

        // Deal SSV tokens
        deal(address(ssv), address(nativeStakingSSVStrategy), 1_000 ether);

        Cluster memory cluster = _getCluster();

        // Build arrays
        bytes[] memory pubkeys = new bytes[](1);
        pubkeys[0] = TEST_VALIDATOR_PUBKEY;
        bytes[] memory sharesData = new bytes[](1);
        sharesData[0] = TEST_SHARES_DATA;
        uint64[] memory operatorIds = _getTestOperatorIds();

        // Record logs to capture updated cluster
        vm.recordLogs();

        // Register first time
        vm.prank(validatorRegistratorAddr);
        nativeStakingSSVStrategy.registerSsvValidators(pubkeys, operatorIds, sharesData, cluster);

        // Get updated cluster from logs
        Cluster memory updatedCluster = _extractClusterFromLogs();

        // Try to register again with different operators - should revert
        uint64[] memory differentOperators = new uint64[](4);
        differentOperators[0] = 1;
        differentOperators[1] = 20;
        differentOperators[2] = 300;
        differentOperators[3] = 4000;

        vm.prank(validatorRegistratorAddr);
        vm.expectRevert("Validator already registered");
        nativeStakingSSVStrategy.registerSsvValidators(pubkeys, differentOperators, sharesData, updatedCluster);
    }

    /// @dev Test that deposit emits correct values when WETH already exists on the strategy
    function test_deposit_emitsCorrectValues() public {
        // Deposit 40 WETH (32 will be used for staking, 8 remain)
        _depositToStrategy(40 ether);
        _registerAndStakeEth();

        // Deposit another 10 WETH - Deposit event should emit only the new 10
        vm.recordLogs();
        _depositToStrategy(10 ether);

        // Find the Deposit event from the strategy
        bytes32 depositTopic = keccak256("Deposit(address,address,uint256)");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (
                logs[i].emitter == address(nativeStakingSSVStrategy) && logs[i].topics.length > 0
                    && logs[i].topics[0] == depositTopic
            ) {
                // topics[1] is indexed _asset
                assertEq(logs[i].topics[1], bytes32(uint256(uint160(address(weth)))), "wrong asset");
                // data is (address _pToken, uint256 _amount)
                (address pToken, uint256 amount) = abi.decode(logs[i].data, (address, uint256));
                assertEq(pToken, address(0), "wrong pToken");
                assertEq(amount, 10 ether, "Deposit amount should be exactly 10 ETH");
                found = true;
                break;
            }
        }
        assertTrue(found, "Deposit event not found");
    }
}

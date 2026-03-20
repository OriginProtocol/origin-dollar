// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_NativeStakingSSVStrategy_Shared_Test} from
    "tests/unit/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";
import {ValidatorStakeData} from "contracts/strategies/NativeStaking/ValidatorRegistrator.sol";

contract Unit_Concrete_NativeStakingSSVStrategy_ValidatorStaking_Test
    is Unit_NativeStakingSSVStrategy_Shared_Test
{
    function setUp() public override {
        super.setUp();

        // Fund strategy with SSV tokens and WETH
        deal(address(mockSsv), address(nativeStakingSSVStrategy), 1000 ether);
        vm.prank(josh);
        weth.transfer(address(nativeStakingSSVStrategy), 256 ether);

        // Set staking monitor
        vm.prank(governor);
        nativeStakingSSVStrategy.setStakingMonitor(matt);
    }

    function test_stakeEth_single() public {
        _registerValidator(0);

        ValidatorStakeData[] memory stakeData = new ValidatorStakeData[](1);
        stakeData[0] = ValidatorStakeData({
            pubkey: testPublicKeys[0],
            signature: TEST_SIGNATURE,
            depositDataRoot: TEST_DEPOSIT_DATA_ROOT
        });

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit ETHStaked(keccak256(testPublicKeys[0]), testPublicKeys[0], 32 ether);
        nativeStakingSSVStrategy.stakeEth(stakeData);

        // State should be STAKED
        assertEq(
            uint256(nativeStakingSSVStrategy.validatorsStates(keccak256(testPublicKeys[0]))), 2
        );
    }

    function test_stakeEth_twoValidators() public {
        _registerValidator(0);
        _registerValidator(1);

        // Stake both one at a time
        ValidatorStakeData[] memory stakeData = new ValidatorStakeData[](1);
        stakeData[0] = ValidatorStakeData({
            pubkey: testPublicKeys[0],
            signature: TEST_SIGNATURE,
            depositDataRoot: TEST_DEPOSIT_DATA_ROOT
        });
        vm.prank(governor);
        nativeStakingSSVStrategy.stakeEth(stakeData);

        stakeData[0] = ValidatorStakeData({
            pubkey: testPublicKeys[1],
            signature: TEST_SIGNATURE,
            depositDataRoot: TEST_DEPOSIT_DATA_ROOT
        });
        vm.prank(governor);
        nativeStakingSSVStrategy.stakeEth(stakeData);

        assertEq(
            uint256(nativeStakingSSVStrategy.validatorsStates(keccak256(testPublicKeys[1]))), 2
        );
    }

    function test_stakeEth_RevertWhen_thresholdExceeded() public {
        _registerValidator(0);
        _registerValidator(1);
        _registerValidator(2);

        // Stake first two (64 ETH = threshold)
        for (uint256 i = 0; i < 2; i++) {
            ValidatorStakeData[] memory stakeData = new ValidatorStakeData[](1);
            stakeData[0] = ValidatorStakeData({
                pubkey: testPublicKeys[i],
                signature: TEST_SIGNATURE,
                depositDataRoot: TEST_DEPOSIT_DATA_ROOT
            });
            vm.prank(governor);
            nativeStakingSSVStrategy.stakeEth(stakeData);
        }

        // Third should fail (96 > 64 threshold)
        ValidatorStakeData[] memory stakeData3 = new ValidatorStakeData[](1);
        stakeData3[0] = ValidatorStakeData({
            pubkey: testPublicKeys[2],
            signature: TEST_SIGNATURE,
            depositDataRoot: TEST_DEPOSIT_DATA_ROOT
        });

        vm.prank(governor);
        vm.expectRevert("Staking ETH over threshold");
        nativeStakingSSVStrategy.stakeEth(stakeData3);
    }

    function test_stakeEth_RevertWhen_validatorNotRegistered() public {
        ValidatorStakeData[] memory stakeData = new ValidatorStakeData[](1);
        stakeData[0] = ValidatorStakeData({
            pubkey: TEST_PUBLIC_KEY,
            signature: TEST_SIGNATURE,
            depositDataRoot: TEST_DEPOSIT_DATA_ROOT
        });

        vm.prank(governor);
        vm.expectRevert("Validator not registered");
        nativeStakingSSVStrategy.stakeEth(stakeData);
    }

    function test_stakeEth_continuallyAfterThresholdReset() public {
        // Register 6 validators
        for (uint256 i = 0; i < 6; i++) {
            _registerValidator(i);
        }

        // Stake 2, reset, stake 2, reset, stake 2
        for (uint256 batch = 0; batch < 3; batch++) {
            for (uint256 i = 0; i < 2; i++) {
                uint256 idx = batch * 2 + i;
                ValidatorStakeData[] memory stakeData = new ValidatorStakeData[](1);
                stakeData[0] = ValidatorStakeData({
                    pubkey: testPublicKeys[idx],
                    signature: TEST_SIGNATURE,
                    depositDataRoot: TEST_DEPOSIT_DATA_ROOT
                });
                vm.prank(governor);
                nativeStakingSSVStrategy.stakeEth(stakeData);
            }

            if (batch < 2) {
                vm.prank(matt);
                nativeStakingSSVStrategy.resetStakeETHTally();
            }
        }

        // All 6 should be staked
        for (uint256 i = 0; i < 6; i++) {
            assertEq(
                uint256(nativeStakingSSVStrategy.validatorsStates(keccak256(testPublicKeys[i]))), 2
            );
        }
    }

    // ----------------
    // Events
    // ----------------

    event ETHStaked(bytes32 indexed pubKeyHash, bytes pubKey, uint256 amount);
}

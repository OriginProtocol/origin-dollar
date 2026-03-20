// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_NativeStakingSSVStrategy_Shared_Test} from
    "tests/fork/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";
import {ValidatorAccountant} from "contracts/strategies/NativeStaking/ValidatorAccountant.sol";

contract Fork_Concrete_NativeStakingSSVStrategy_DoAccounting_Test
    is Fork_NativeStakingSSVStrategy_Shared_Test
{
    uint256 internal strategyBalanceBefore;
    uint256 internal consensusRewardsBefore;
    uint256 internal constant ACTIVE_VALIDATORS = 30_000;

    function setUp() public override {
        super.setUp();

        // Clear any ETH sitting in the strategy
        vm.prank(validatorRegistratorAddr);
        nativeStakingSSVStrategy.doAccounting();

        // Clear out any consensus rewards via harvest
        vm.prank(validatorRegistratorAddr);
        harvester.harvestAndTransfer(address(nativeStakingSSVStrategy));

        // Set activeDepositedValidators to a high number (slot 52)
        vm.store(
            address(nativeStakingSSVStrategy),
            bytes32(uint256(52)),
            bytes32(uint256(ACTIVE_VALIDATORS))
        );

        strategyBalanceBefore = nativeStakingSSVStrategy.checkBalance(address(weth));
        consensusRewardsBefore = nativeStakingSSVStrategy.consensusRewards();
    }

    /// @dev Test accounting for new consensus rewards
    function test_doAccounting_consensusRewards() public {
        uint256 rewards = 2 ether;

        // Simulate consensus rewards by setting ETH balance
        vm.deal(address(nativeStakingSSVStrategy), consensusRewardsBefore + rewards);

        vm.prank(validatorRegistratorAddr);
        vm.expectEmit(true, true, true, true, address(nativeStakingSSVStrategy));
        emit ValidatorAccountant.AccountingConsensusRewards(rewards);
        nativeStakingSSVStrategy.doAccounting();

        // checkBalance should not change (consensus rewards don't affect it until harvested)
        assertEq(
            nativeStakingSSVStrategy.checkBalance(address(weth)),
            strategyBalanceBefore,
            "checkBalance should not increase"
        );

        // consensusRewards should increase
        assertEq(
            nativeStakingSSVStrategy.consensusRewards(),
            consensusRewardsBefore + rewards,
            "consensusRewards should increase"
        );
    }

    /// @dev Test accounting for validator withdrawals and consensus rewards
    function test_doAccounting_withdrawalsAndConsensusRewards() public {
        uint256 rewards = 3 ether;
        uint256 withdrawals = 64 ether; // 2 validators
        uint256 expectedConsensusRewards = rewards - consensusRewardsBefore;
        uint256 vaultWethBalanceBefore = weth.balanceOf(address(oethVault));

        // Simulate withdraw of 2 validators + consensus rewards
        vm.deal(address(nativeStakingSSVStrategy), withdrawals + rewards);

        vm.prank(validatorRegistratorAddr);
        vm.expectEmit(true, true, true, true, address(nativeStakingSSVStrategy));
        emit ValidatorAccountant.AccountingFullyWithdrawnValidator(2, ACTIVE_VALIDATORS - 2, withdrawals);
        nativeStakingSSVStrategy.doAccounting();

        // checkBalance should decrease by withdrawal amount
        assertEq(
            nativeStakingSSVStrategy.checkBalance(address(weth)),
            strategyBalanceBefore - withdrawals,
            "checkBalance should decrease"
        );

        // consensusRewards should increase
        assertEq(
            nativeStakingSSVStrategy.consensusRewards(),
            consensusRewardsBefore + expectedConsensusRewards,
            "consensusRewards should increase"
        );

        // activeDepositedValidators should decrease
        assertEq(
            nativeStakingSSVStrategy.activeDepositedValidators(),
            ACTIVE_VALIDATORS - 2,
            "active validators decreases"
        );

        // Vault WETH should increase by withdrawal amount
        assertEq(
            weth.balanceOf(address(oethVault)),
            vaultWethBalanceBefore + withdrawals,
            "WETH in vault should increase"
        );
    }
}

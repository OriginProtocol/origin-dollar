// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Fork_NativeStakingSSVStrategy_Shared_Test
} from "tests/fork/mainnet/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";
import {IOETHHarvesterSimple} from "contracts/interfaces/harvest/IOETHHarvesterSimple.sol";

contract Fork_Concrete_NativeStakingSSVStrategy_Harvest_Test is Fork_NativeStakingSSVStrategy_Shared_Test {
    /// @dev Test harvesting execution and consensus rewards
    function test_harvest_executionRewards() public {
        address dripperAddr = harvester.dripper();
        uint256 dripperWethBefore = weth.balanceOf(dripperAddr);
        uint256 strategyBalanceBefore = nativeStakingSSVStrategy.checkBalance(address(weth));
        uint256 feeAccumulatorBalanceBefore = nativeStakingFeeAccumulator.balance;

        // Send ETH to FeeAccumulator to simulate execution rewards
        uint256 executionRewards = 7 ether;
        uint256 ethToSend = executionRewards - feeAccumulatorBalanceBefore;
        vm.prank(josh);
        vm.deal(josh, ethToSend);
        (bool success,) = nativeStakingFeeAccumulator.call{value: ethToSend}("");
        require(success, "ETH transfer to FeeAccumulator failed");

        // Simulate consensus rewards
        uint256 consensusRewards = 5 ether;
        vm.deal(address(nativeStakingSSVStrategy), consensusRewards);

        // Account for the consensus rewards
        vm.prank(validatorRegistratorAddr);
        nativeStakingSSVStrategy.doAccounting();

        // Harvest and transfer rewards to dripper
        vm.expectEmit(true, true, true, true, address(harvester));
        emit IOETHHarvesterSimple.Harvested(
            address(nativeStakingSSVStrategy), address(weth), executionRewards + consensusRewards, dripperAddr
        );
        vm.prank(josh);
        harvester.harvestAndTransfer(address(nativeStakingSSVStrategy));

        // checkBalance should not change
        assertEq(
            nativeStakingSSVStrategy.checkBalance(address(weth)),
            strategyBalanceBefore,
            "checkBalance should not increase"
        );

        // Dripper WETH balance should increase by total rewards
        assertEq(
            weth.balanceOf(dripperAddr),
            dripperWethBefore + executionRewards + consensusRewards,
            "Dripper WETH balance should increase"
        );
    }
}

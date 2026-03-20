// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    Unit_NativeStakingSSVStrategy_Shared_Test
} from "tests/unit/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Concrete_NativeStakingSSVStrategy_RewardCollection_Test is Unit_NativeStakingSSVStrategy_Shared_Test {
    struct RewardTestCase {
        uint256 feeAccumulatorEth;
        uint256 consensusRewards;
        uint256 deposits;
        uint256 nrOfActiveDepositedValidators;
        uint256 expectedHarvester;
        uint256 expectedBalance;
    }

    function _setupRewardTest(RewardTestCase memory tc) internal {
        // Setup consensus rewards on strategy
        if (tc.consensusRewards > 0) {
            vm.deal(address(nativeStakingSSVStrategy), tc.consensusRewards);
        }
        // Setup execution rewards on fee accumulator
        if (tc.feeAccumulatorEth > 0) {
            vm.deal(address(nativeStakingFeeAccumulator), tc.feeAccumulatorEth);
        }
        // Setup WETH deposits
        if (tc.deposits > 0) {
            vm.prank(josh);
            weth.transfer(address(nativeStakingSSVStrategy), tc.deposits);
        }

        _setActiveDepositedValidators(tc.nrOfActiveDepositedValidators);
        _setConsensusRewards(tc.consensusRewards);

        // Run accounting
        vm.prank(governor);
        nativeStakingSSVStrategy.doAccounting();
    }

    // no rewards to harvest
    function test_collectRewardTokens_noRewards() public {
        RewardTestCase memory tc = RewardTestCase({
            feeAccumulatorEth: 0,
            consensusRewards: 0,
            deposits: 0,
            nrOfActiveDepositedValidators: 0,
            expectedHarvester: 0,
            expectedBalance: 0
        });
        _setupRewardTest(tc);

        uint256 harvesterBefore = IERC20(address(mockWeth)).balanceOf(nick);
        vm.prank(nick);
        nativeStakingSSVStrategy.collectRewardTokens();
        uint256 harvesterAfter = IERC20(address(mockWeth)).balanceOf(nick);
        assertEq(harvesterAfter - harvesterBefore, tc.expectedHarvester);
    }

    // execution rewards only
    function test_collectRewardTokens_executionRewardsOnly() public {
        RewardTestCase memory tc = RewardTestCase({
            feeAccumulatorEth: 0.1 ether,
            consensusRewards: 0,
            deposits: 0,
            nrOfActiveDepositedValidators: 0,
            expectedHarvester: 0.1 ether,
            expectedBalance: 0
        });
        _setupRewardTest(tc);

        uint256 harvesterBefore = IERC20(address(mockWeth)).balanceOf(nick);
        vm.prank(nick);
        nativeStakingSSVStrategy.collectRewardTokens();
        uint256 harvesterAfter = IERC20(address(mockWeth)).balanceOf(nick);
        assertEq(harvesterAfter - harvesterBefore, tc.expectedHarvester);
    }

    // consensus rewards only
    function test_collectRewardTokens_consensusRewardsOnly() public {
        RewardTestCase memory tc = RewardTestCase({
            feeAccumulatorEth: 0,
            consensusRewards: 0.2 ether,
            deposits: 0,
            nrOfActiveDepositedValidators: 0,
            expectedHarvester: 0.2 ether,
            expectedBalance: 0
        });
        _setupRewardTest(tc);

        uint256 harvesterBefore = IERC20(address(mockWeth)).balanceOf(nick);
        vm.prank(nick);
        nativeStakingSSVStrategy.collectRewardTokens();
        uint256 harvesterAfter = IERC20(address(mockWeth)).balanceOf(nick);
        assertEq(harvesterAfter - harvesterBefore, tc.expectedHarvester);
    }

    // both rewards
    function test_collectRewardTokens_bothRewards() public {
        RewardTestCase memory tc = RewardTestCase({
            feeAccumulatorEth: 0.1 ether,
            consensusRewards: 0.2 ether,
            deposits: 0,
            nrOfActiveDepositedValidators: 0,
            expectedHarvester: 0.3 ether,
            expectedBalance: 0
        });
        _setupRewardTest(tc);

        uint256 harvesterBefore = IERC20(address(mockWeth)).balanceOf(nick);
        vm.prank(nick);
        nativeStakingSSVStrategy.collectRewardTokens();
        uint256 harvesterAfter = IERC20(address(mockWeth)).balanceOf(nick);
        assertEq(harvesterAfter - harvesterBefore, tc.expectedHarvester);
    }

    // large rewards with deposits and validators
    function test_collectRewardTokens_largeWithDepositsAndValidators() public {
        RewardTestCase memory tc = RewardTestCase({
            feeAccumulatorEth: 2.2 ether,
            consensusRewards: 16.3 ether,
            deposits: 100 ether,
            nrOfActiveDepositedValidators: 7,
            expectedHarvester: 18.5 ether,
            expectedBalance: 100 ether + 7 * 32 ether
        });
        _setupRewardTest(tc);

        uint256 harvesterBefore = IERC20(address(mockWeth)).balanceOf(nick);
        vm.prank(nick);
        nativeStakingSSVStrategy.collectRewardTokens();
        uint256 harvesterAfter = IERC20(address(mockWeth)).balanceOf(nick);
        assertEq(harvesterAfter - harvesterBefore, tc.expectedHarvester);
    }

    // Check balance after reward collection
    function test_checkBalance_afterRewardSetup() public {
        RewardTestCase memory tc = RewardTestCase({
            feeAccumulatorEth: 10.2 ether,
            consensusRewards: 21.5 ether,
            deposits: 0,
            nrOfActiveDepositedValidators: 5,
            expectedHarvester: 31.7 ether,
            expectedBalance: 5 * 32 ether
        });
        _setupRewardTest(tc);

        assertEq(nativeStakingSSVStrategy.checkBalance(address(mockWeth)), tc.expectedBalance);
    }

    // Check balance with deposits + validators
    function test_checkBalance_depositsAndValidators() public {
        RewardTestCase memory tc = RewardTestCase({
            feeAccumulatorEth: 10.2 ether,
            consensusRewards: 21.5 ether,
            deposits: 1 ether,
            nrOfActiveDepositedValidators: 0,
            expectedHarvester: 31.7 ether,
            expectedBalance: 1 ether
        });
        _setupRewardTest(tc);

        assertEq(nativeStakingSSVStrategy.checkBalance(address(mockWeth)), tc.expectedBalance);
    }
}

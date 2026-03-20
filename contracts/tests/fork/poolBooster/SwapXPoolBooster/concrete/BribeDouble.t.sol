// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Vm} from "forge-std/Vm.sol";

import {Fork_SwapXPoolBooster_Shared_Test} from "tests/fork/poolBooster/SwapXPoolBooster/shared/Shared.t.sol";
import {PoolBoosterSwapxDouble} from "contracts/poolBooster/PoolBoosterSwapxDouble.sol";
import {Sonic} from "tests/utils/Addresses.sol";

contract Fork_Concrete_SwapXPoolBooster_BribeDouble_Test is Fork_SwapXPoolBooster_Shared_Test {
    // SwapX bribe contract event: RewardAdded(address rewardToken, uint256 reward, uint256 startTimestamp)
    bytes32 internal constant REWARD_ADDED_TOPIC = keccak256("RewardAdded(address,uint256,uint256)");

    function test_bribe() public {
        PoolBoosterSwapxDouble booster = _createDoubleBooster(
            Sonic.SwapXOsUSDCe_extBribeOS,
            Sonic.SwapXOsUSDCe_extBribeUSDC,
            Sonic.SwapXOsUSDCe_pool,
            0.7e18, // 70% split
            1
        );

        // Whitelist mock token on both bribe contracts
        _whitelistOnBribe(Sonic.SwapXOsUSDCe_extBribeOS);
        _whitelistOnBribe(Sonic.SwapXOsUSDCe_extBribeUSDC);

        // Fund the booster with 10e18 OS tokens
        _dealOSToken(address(booster), 10e18);
        uint256 bribeBalance = oSonic.balanceOf(address(booster));

        uint256 expectedOsAmount = (bribeBalance * 0.7e18) / 1e18;
        uint256 expectedOtherAmount = bribeBalance - expectedOsAmount;

        vm.recordLogs();
        booster.bribe();
        Vm.Log[] memory entries = vm.getRecordedLogs();

        // Find RewardAdded events
        uint256 rewardAddedCount;
        for (uint256 i; i < entries.length; i++) {
            if (entries[i].topics[0] == REWARD_ADDED_TOPIC) {
                (address rewardToken, uint256 amount,) = abi.decode(entries[i].data, (address, uint256, uint256));
                assertEq(rewardToken, address(oSonic));

                if (rewardAddedCount == 0) {
                    assertApproxEqAbs(amount, expectedOsAmount, 1);
                } else if (rewardAddedCount == 1) {
                    assertApproxEqAbs(amount, expectedOtherAmount, 1);
                }
                rewardAddedCount++;
            }
        }
        assertEq(rewardAddedCount, 2, "Expected 2 RewardAdded events");
        assertEq(oSonic.balanceOf(address(booster)), 0);
    }

    function test_bribe_skippedWhenAmountTooSmall() public {
        PoolBoosterSwapxDouble booster = _createDoubleBooster(
            Sonic.SwapXOsUSDCe_extBribeOS, Sonic.SwapXOsUSDCe_extBribeUSDC, Sonic.SwapXOsUSDCe_pool, 0.7e18, 1
        );

        // Fund with 1e9 (below MIN_BRIBE_AMOUNT of 1e10)
        _dealOSToken(address(booster), 1e9);

        booster.bribe();

        // Balance should be unchanged
        assertEq(oSonic.balanceOf(address(booster)), 1e9);
    }
}

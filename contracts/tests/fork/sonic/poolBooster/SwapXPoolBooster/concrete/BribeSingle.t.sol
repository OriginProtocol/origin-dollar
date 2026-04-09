// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Fork_SwapXPoolBooster_Shared_Test} from "tests/fork/sonic/poolBooster/SwapXPoolBooster/shared/Shared.t.sol";

// --- Test utilities
import {Sonic} from "tests/utils/Addresses.sol";

// --- External libraries
import {Vm} from "forge-std/Vm.sol";

// --- Project imports
import {IPoolBoosterSwapxSingle} from "contracts/interfaces/poolBooster/IPoolBoosterSwapxSingle.sol";

contract Fork_Concrete_SwapXPoolBooster_BribeSingle_Test is Fork_SwapXPoolBooster_Shared_Test {
    bytes32 internal constant REWARD_ADDED_TOPIC = keccak256("RewardAdded(address,uint256,uint256)");

    function test_bribe() public {
        IPoolBoosterSwapxSingle booster =
            _createSingleBooster(Sonic.SwapXOsUSDCe_extBribeOS, Sonic.SwapXOsUSDCe_pool, 1);

        // Whitelist mock token on bribe contract
        _whitelistOnBribe(Sonic.SwapXOsUSDCe_extBribeOS);

        // Fund the booster with 10e18 OS tokens
        _dealOSToken(address(booster), 10e18);
        uint256 bribeBalance = oSonic.balanceOf(address(booster));

        vm.recordLogs();
        booster.bribe();
        Vm.Log[] memory entries = vm.getRecordedLogs();

        // Find RewardAdded event
        uint256 rewardAddedCount;
        for (uint256 i; i < entries.length; i++) {
            if (entries[i].topics[0] == REWARD_ADDED_TOPIC) {
                (address rewardToken, uint256 amount,) = abi.decode(entries[i].data, (address, uint256, uint256));
                assertEq(rewardToken, address(oSonic));
                assertEq(amount, bribeBalance);
                rewardAddedCount++;
            }
        }
        assertEq(rewardAddedCount, 1, "Expected 1 RewardAdded event");
        assertEq(oSonic.balanceOf(address(booster)), 0);
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Vm} from "forge-std/Vm.sol";

import {Fork_MetropolisPoolBooster_Shared_Test} from "tests/fork/poolBooster/MetropolisPoolBooster/shared/Shared.t.sol";
import {PoolBoosterMetropolis} from "contracts/poolBooster/PoolBoosterMetropolis.sol";
import {IPoolBooster} from "contracts/interfaces/poolBooster/IPoolBooster.sol";
import {Sonic} from "tests/utils/Addresses.sol";

contract Fork_Concrete_MetropolisPoolBooster_CreateAndBribe_Test is Fork_MetropolisPoolBooster_Shared_Test {
    bytes32 internal constant BRIBE_EXECUTED_TOPIC = keccak256("BribeExecuted(uint256)");

    function test_createPoolBoosterMetropolis() public {
        _createMetropolisBooster(Sonic.Metropolis_Pools_OsMoon, 1);

        assertEq(factoryMetropolis.poolBoosterLength(), 1);
    }

    function test_bribe_twiceInARow() public {
        PoolBoosterMetropolis booster = _createMetropolisBooster(Sonic.Metropolis_Pools_OsMoon, 1);

        // First bribe: 100,000e18
        _dealOSToken(address(booster), 100_000e18);

        vm.recordLogs();
        booster.bribe();
        _assertBribeExecuted(vm.getRecordedLogs(), address(booster), 100_000e18);
        assertEq(oSonic.balanceOf(address(booster)), 0);

        // Second bribe: 500,000e18
        _dealOSToken(address(booster), 500_000e18);

        vm.recordLogs();
        booster.bribe();
        _assertBribeExecuted(vm.getRecordedLogs(), address(booster), 500_000e18);
        assertEq(oSonic.balanceOf(address(booster)), 0);
    }

    function _assertBribeExecuted(Vm.Log[] memory entries, address emitter, uint256 expectedAmount) internal pure {
        uint256 count;
        for (uint256 i; i < entries.length; i++) {
            if (entries[i].topics[0] == BRIBE_EXECUTED_TOPIC && entries[i].emitter == emitter) {
                uint256 amount = abi.decode(entries[i].data, (uint256));
                assert(amount == expectedAmount);
                count++;
            }
        }
        assert(count == 1);
    }
}

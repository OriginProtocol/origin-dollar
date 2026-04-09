// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Fork_MetropolisPoolBooster_Shared_Test
} from "tests/fork/sonic/poolBooster/MetropolisPoolBooster/shared/Shared.t.sol";

// --- Test utilities
import {Sonic} from "tests/utils/Addresses.sol";

// --- Project imports
import {IPoolBoosterMetropolis} from "contracts/interfaces/poolBooster/IPoolBoosterMetropolis.sol";

contract Fork_Concrete_MetropolisPoolBooster_BribeSkipped_Test is Fork_MetropolisPoolBooster_Shared_Test {
    function test_bribe_skippedBelowMinBribeAmount() public {
        IPoolBoosterMetropolis booster = _createMetropolisBooster(Sonic.Metropolis_Pools_OsMoon, 1);

        // Fund with 100 wei (below MIN_BRIBE_AMOUNT of 1e10)
        _dealOSToken(address(booster), 100);

        booster.bribe();

        // Balance should be unchanged
        assertEq(oSonic.balanceOf(address(booster)), 100);
    }

    function test_bribe_skippedBelowFactoryMinAmount() public {
        IPoolBoosterMetropolis booster = _createMetropolisBooster(Sonic.Metropolis_Pools_OsMoon, 1);

        // Fund with 1e12 (above MIN_BRIBE_AMOUNT but below Metropolis minBribeAmount of 200e18)
        _dealOSToken(address(booster), 1e12);

        booster.bribe();

        // Balance should be unchanged
        assertEq(oSonic.balanceOf(address(booster)), 1e12);
    }
}

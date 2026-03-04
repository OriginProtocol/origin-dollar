// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Merkl_Shared_Test} from "tests/unit/poolBooster/Merkl/shared/Shared.sol";

contract Unit_Concrete_PoolBoosterMerkl_GetNextPeriodStartTime_Test is Unit_Merkl_Shared_Test {
    // DEFAULT_CAMPAIGN_DURATION = 7200

    function test_getNextPeriodStartTime() public {
        // Warp to 7200 (exactly on a boundary)
        vm.warp(7200);
        // next = (7200 / 7200 + 1) * 7200 = (1 + 1) * 7200 = 14400
        uint32 result = boosterMerkl.getNextPeriodStartTime();
        assertEq(result, 14400);
    }

    function test_getNextPeriodStartTime_atBoundary() public {
        // Warp to exactly duration * N, e.g. N=3 -> 21600
        vm.warp(21600);
        // next = (21600 / 7200 + 1) * 7200 = (3 + 1) * 7200 = 28800
        uint32 result = boosterMerkl.getNextPeriodStartTime();
        assertEq(result, 28800);
    }

    function test_getNextPeriodStartTime_justAfterBoundary() public {
        // Warp to duration * N + 1, e.g. N=2 -> 14401
        vm.warp(14401);
        // next = (14401 / 7200 + 1) * 7200 = (2 + 1) * 7200 = 21600
        uint32 result = boosterMerkl.getNextPeriodStartTime();
        assertEq(result, 21600);
    }
}

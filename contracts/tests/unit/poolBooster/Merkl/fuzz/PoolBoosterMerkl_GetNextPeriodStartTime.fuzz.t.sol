// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Merkl_Shared_Test} from "tests/unit/poolBooster/Merkl/shared/Shared.t.sol";

contract Unit_Fuzz_PoolBoosterMerkl_GetNextPeriodStartTime_Test is Unit_Merkl_Shared_Test {
    function testFuzz_getNextPeriodStartTime(uint256 timestamp) public {
        // Bound timestamp to a valid range that won't overflow uint32
        timestamp = bound(timestamp, 1, uint256(type(uint32).max) - DEFAULT_CAMPAIGN_DURATION);

        vm.warp(timestamp);

        uint32 result = boosterMerkl.getNextPeriodStartTime();

        // The next period start time must be strictly greater than the current timestamp
        assertGt(result, timestamp);

        // The result must be aligned to the campaign duration boundary
        assertEq(uint256(result) % DEFAULT_CAMPAIGN_DURATION, 0);
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_AerodromeAMOStrategy_Shared_Test} from "tests/unit/strategies/AerodromeAMOStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_AerodromeAMOStrategy_Rebalance_Test is Unit_AerodromeAMOStrategy_Shared_Test {
    function testFuzz_setAllowedPoolWethShareInterval(uint256 start, uint256 end) public {
        // Bound to valid range
        start = bound(start, 0.01 ether + 1, 0.94 ether);
        end = bound(end, start + 1, 0.95 ether - 1);

        vm.prank(governor);
        aerodromeAMOStrategy.setAllowedPoolWethShareInterval(start, end);

        assertEq(aerodromeAMOStrategy.allowedWethShareStart(), start);
        assertEq(aerodromeAMOStrategy.allowedWethShareEnd(), end);
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicSwapXAMOStrategy_Shared_Test} from
    "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_SonicSwapXAMOStrategy_SetMaxDepeg_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    /// @notice Any value can be set as maxDepeg (no cap enforced in contract)
    function testFuzz_setMaxDepeg_anyValueAccepted(uint256 value) public {
        vm.prank(governor);
        sonicSwapXAMOStrategy.setMaxDepeg(value);

        assertEq(sonicSwapXAMOStrategy.maxDepeg(), value);
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Governance_Shared_Test} from "tests/unit/governance/shared/Shared.t.sol";

contract Unit_Concrete_Governance_Governor_Test is Unit_Governance_Shared_Test {
    // --- governor() ---

    function test_governor_returnsCorrectAddress() public view {
        assertEq(governable.governor(), governor);
    }

    // --- isGovernor() ---

    function test_isGovernor_returnsTrueForGovernor() public {
        vm.prank(governor);
        assertTrue(governable.isGovernor());
    }

    function test_isGovernor_returnsFalseForNonGovernor() public {
        vm.prank(alice);
        assertFalse(governable.isGovernor());
    }
}

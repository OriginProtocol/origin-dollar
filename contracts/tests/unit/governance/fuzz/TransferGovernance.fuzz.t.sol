// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Governance_Shared_Test} from "tests/unit/governance/shared/Shared.t.sol";

contract Unit_Fuzz_Governance_TransferGovernance_Test is Unit_Governance_Shared_Test {
    function testFuzz_transferAndClaim(address _newGovernor) public {
        vm.assume(_newGovernor != address(0));

        // Transfer governance
        vm.prank(governor);
        governable.transferGovernance(_newGovernor);

        // Governor hasn't changed yet
        assertEq(governable.governor(), governor);

        // Claim governance
        vm.prank(_newGovernor);
        governable.claimGovernance();

        // New governor is set
        assertEq(governable.governor(), _newGovernor);
    }
}

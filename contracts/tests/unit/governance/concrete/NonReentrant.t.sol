// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Governance_Shared_Test} from "tests/unit/governance/shared/Shared.t.sol";

// --- Project imports
import {ReentrancyAttacker} from "tests/mocks/MockGovernable.sol";

contract Unit_Concrete_Governance_NonReentrant_Test is Unit_Governance_Shared_Test {
    // --- nonReentrant modifier ---

    function test_nonReentrant_normalCallSucceeds() public {
        uint256 result = governable.protectedFunction();
        assertEq(result, 1);
    }

    function test_nonReentrant_RevertWhen_reentrantCall() public {
        // Deploy attacker that will call back into governable
        ReentrancyAttacker attacker = new ReentrancyAttacker(governable);

        // The outer call succeeds (low-level call ignores inner revert),
        // but the inner re-entry hits the nonReentrant require revert path.
        governable.protectedWithCallback(address(attacker));
    }
}

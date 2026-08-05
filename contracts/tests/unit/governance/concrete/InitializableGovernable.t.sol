// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Governance_Shared_Test} from "tests/unit/governance/shared/Shared.t.sol";

// --- Project imports
import {Governable} from "contracts/governance/Governable.sol";

contract Unit_Concrete_Governance_InitializableGovernable_Test is Unit_Governance_Shared_Test {
    // --- _initialize (via exposed initialize) ---

    function test_initialize_setsGovernor() public {
        initGovernable.initialize(governor);
        assertEq(initGovernable.governor(), governor);
    }

    function test_initialize_emitsGovernorshipTransferred() public {
        vm.expectEmit(true, true, true, true);
        emit Governable.GovernorshipTransferred(address(0), governor);

        initGovernable.initialize(governor);
    }

    function test_initialize_RevertWhen_zeroAddress() public {
        vm.expectRevert("New Governor is address(0)");
        initGovernable.initialize(address(0));
    }

    function test_initialize_RevertWhen_alreadyInitialized() public {
        initGovernable.initialize(governor);

        vm.expectRevert("Initializable: contract is already initialized");
        initGovernable.initialize(alice);
    }
}

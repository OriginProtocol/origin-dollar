// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_ConsolidationController_Shared_Test} from "../shared/Shared.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_ConsolidationController_Operations_Test is Smoke_ConsolidationController_Shared_Test {
    // --- doAccounting ---

    function test_doAccounting_strategy2() public {
        vm.prank(Mainnet.validatorRegistrator);
        bool accountingValid = consolidationController.doAccounting(address(nativeStakingSSVStrategy2));
        assertTrue(accountingValid, "doAccounting for strategy 2 should return true");
    }

    function test_doAccounting_strategy3() public {
        vm.prank(Mainnet.validatorRegistrator);
        bool accountingValid = consolidationController.doAccounting(address(nativeStakingSSVStrategy3));
        assertTrue(accountingValid, "doAccounting for strategy 3 should return true");
    }

    // --- Forwarding ---

    function test_consolidationController_forwardsToCompoundingStrategy() public view {
        // Verify the consolidation controller can read from the target strategy
        // by checking immutable configuration that's available via view calls.
        address registrator = compoundingStakingSSVStrategy.validatorRegistrator();
        assertEq(
            registrator,
            address(consolidationController),
            "CompoundingStrategy registrator should be ConsolidationController"
        );
    }
}

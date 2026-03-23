// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_ConsolidationController_Shared_Test} from "../shared/Shared.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_ConsolidationController_Configuration_Test is Smoke_ConsolidationController_Shared_Test {
    // --- Ownership ---

    function test_owner_isGuardian() public view {
        assertEq(consolidationController.owner(), Mainnet.Guardian, "ConsolidationController owner should be Guardian");
    }

    // --- Validator Registrator ---

    function test_validatorRegistrator_isCorrect() public view {
        assertEq(
            consolidationController.validatorRegistrator(),
            Mainnet.validatorRegistrator,
            "validatorRegistrator mismatch"
        );
    }

    // --- Strategy Registrators ---

    function test_nativeStakingStrategy2_registrator_isConsolidationController() public view {
        assertEq(
            nativeStakingSSVStrategy2.validatorRegistrator(),
            address(consolidationController),
            "Strategy 2 registrator should be ConsolidationController"
        );
    }

    function test_nativeStakingStrategy3_registrator_isConsolidationController() public view {
        assertEq(
            nativeStakingSSVStrategy3.validatorRegistrator(),
            address(consolidationController),
            "Strategy 3 registrator should be ConsolidationController"
        );
    }

    function test_compoundingStakingSSVStrategy_registrator_isConsolidationController() public view {
        assertEq(
            compoundingStakingSSVStrategy.validatorRegistrator(),
            address(consolidationController),
            "CompoundingStakingSSVStrategy registrator should be ConsolidationController"
        );
    }

    // --- Consolidation State ---

    function test_consolidationState_isValid() public view {
        uint64 count = consolidationController.consolidationCount();
        if (count == 0) {
            // No consolidation — source strategy and target pub key hash should be zeroed
            assertEq(consolidationController.sourceStrategy(), address(0));
            assertEq(consolidationController.targetPubKeyHash(), bytes32(0));
        } else {
            // Active consolidation — source strategy should be one of the two strategies
            address source = consolidationController.sourceStrategy();
            assertTrue(
                source == address(nativeStakingSSVStrategy2) || source == address(nativeStakingSSVStrategy3),
                "sourceStrategy should be strategy 2 or 3"
            );
            assertTrue(consolidationController.targetPubKeyHash() != bytes32(0), "targetPubKeyHash should be set");
        }
    }
}

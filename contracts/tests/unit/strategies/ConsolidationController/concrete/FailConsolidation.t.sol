// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_ConsolidationController_Shared_Test} from "../shared/Shared.t.sol";

contract Unit_ConsolidationController_FailConsolidation_Test is Unit_ConsolidationController_Shared_Test {
    bytes[] internal sourcePubKeys;

    function setUp() public override {
        super.setUp();
        _setupForConsolidation();

        // Request consolidation of 3 validators from strategy 2
        sourcePubKeys = new bytes[](3);
        sourcePubKeys[0] = TEST_PUB_KEY_1;
        sourcePubKeys[1] = TEST_PUB_KEY_2;
        sourcePubKeys[2] = TEST_PUB_KEY_3;

        vm.deal(guardian, 1 ether);
        _requestConsolidation(address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY);
    }

    //////////////////////////////////////////////////////
    /// --- ACCESS CONTROL
    //////////////////////////////////////////////////////

    function test_RevertWhen_CalledByNonOwner_Registrator() public {
        _advancePastConsolidationPeriod();

        bytes[] memory failedKeys = new bytes[](1);
        failedKeys[0] = TEST_PUB_KEY_1;

        vm.prank(governor);
        vm.expectRevert("Ownable: caller is not the owner");
        consolidationController.failConsolidation(failedKeys);
    }

    function test_RevertWhen_CalledByNonOwner_RandomUser() public {
        _advancePastConsolidationPeriod();

        bytes[] memory failedKeys = new bytes[](1);
        failedKeys[0] = TEST_PUB_KEY_1;

        vm.prank(josh);
        vm.expectRevert("Ownable: caller is not the owner");
        consolidationController.failConsolidation(failedKeys);
    }

    function test_RevertWhen_CalledByNonOwner_Strategist() public {
        _advancePastConsolidationPeriod();

        bytes[] memory failedKeys = new bytes[](1);
        failedKeys[0] = TEST_PUB_KEY_1;

        vm.prank(strategist);
        vm.expectRevert("Ownable: caller is not the owner");
        consolidationController.failConsolidation(failedKeys);
    }

    //////////////////////////////////////////////////////
    /// --- STATE CHECKS
    //////////////////////////////////////////////////////

    function test_RevertWhen_NoConsolidationInProgress() public {
        // Fail all to reset state
        _advancePastConsolidationPeriod();

        vm.prank(guardian);
        consolidationController.failConsolidation(sourcePubKeys);

        // Now try again - should fail
        bytes[] memory failedKeys = new bytes[](1);
        failedKeys[0] = TEST_PUB_KEY_1;

        vm.prank(guardian);
        vm.expectRevert("No consolidation in progress");
        consolidationController.failConsolidation(failedKeys);
    }

    function test_RevertWhen_TooSoon() public {
        // Don't advance time past the consolidation period
        bytes[] memory failedKeys = new bytes[](1);
        failedKeys[0] = TEST_PUB_KEY_1;

        vm.prank(guardian);
        vm.expectRevert("Source not withdrawable");
        consolidationController.failConsolidation(failedKeys);
    }

    function test_RevertWhen_InvalidPubKeyLength() public {
        _advancePastConsolidationPeriod();

        bytes[] memory failedKeys = new bytes[](1);
        failedKeys[0] = INVALID_PUB_KEY;

        vm.prank(guardian);
        vm.expectRevert("Invalid public key");
        consolidationController.failConsolidation(failedKeys);
    }

    function test_RevertWhen_UnknownSourceValidator() public {
        _advancePastConsolidationPeriod();

        // Use a pub key that was not in the consolidation request
        bytes memory unknownPubKey =
            hex"808f0e79b73f968e064ecba2702a65bed93cf46149a69f0e4de921b44eab3fd456a1ca0f082887069e5831e139eb2690";

        bytes[] memory failedKeys = new bytes[](1);
        failedKeys[0] = unknownPubKey;

        vm.prank(guardian);
        vm.expectRevert("Unknown source validator");
        consolidationController.failConsolidation(failedKeys);
    }

    function test_RevertWhen_ExceedsConsolidationCount() public {
        _advancePastConsolidationPeriod();

        // Fail 2 first, then try to fail 2 more (only 1 left)
        bytes[] memory twoKeys = new bytes[](2);
        twoKeys[0] = TEST_PUB_KEY_1;
        twoKeys[1] = TEST_PUB_KEY_2;

        vm.prank(guardian);
        consolidationController.failConsolidation(twoKeys);

        // Now only 1 consolidation left, try to fail 2
        bytes[] memory twoMoreKeys = new bytes[](2);
        twoMoreKeys[0] = TEST_PUB_KEY_3;
        twoMoreKeys[1] = TEST_PUB_KEY_1; // already failed

        vm.prank(guardian);
        vm.expectRevert("Exceeds consolidation count");
        consolidationController.failConsolidation(twoMoreKeys);
    }

    //////////////////////////////////////////////////////
    /// --- HAPPY PATH
    //////////////////////////////////////////////////////

    function test_FailConsolidation_SingleValidator() public {
        _advancePastConsolidationPeriod();

        assertEq(consolidationController.consolidationCount(), 3);

        bytes[] memory failedKeys = new bytes[](1);
        failedKeys[0] = TEST_PUB_KEY_1;

        vm.prank(guardian);
        consolidationController.failConsolidation(failedKeys);

        // State: count reduced but consolidation still in progress
        assertEq(consolidationController.consolidationCount(), 2);
        assertEq(consolidationController.sourceStrategy(), address(nativeStakingSSVStrategy2));
        assertNotEq(consolidationController.targetPubKeyHash(), bytes32(0));

        // Source validator restored to STAKED state
        bytes32 sourcePubKeyHash = keccak256(TEST_PUB_KEY_1);
        assertEq(uint256(nativeStakingSSVStrategy2.validatorsStates(sourcePubKeyHash)), 2); // STAKED
    }

    function test_FailConsolidation_MultipleValidators() public {
        _advancePastConsolidationPeriod();

        bytes[] memory failedKeys = new bytes[](2);
        failedKeys[0] = TEST_PUB_KEY_1;
        failedKeys[1] = TEST_PUB_KEY_2;

        vm.prank(guardian);
        consolidationController.failConsolidation(failedKeys);

        // State: count reduced but consolidation still in progress
        assertEq(consolidationController.consolidationCount(), 1);
        assertEq(consolidationController.sourceStrategy(), address(nativeStakingSSVStrategy2));
        assertNotEq(consolidationController.targetPubKeyHash(), bytes32(0));

        // Source validators restored to STAKED state
        assertEq(uint256(nativeStakingSSVStrategy2.validatorsStates(keccak256(TEST_PUB_KEY_1))), 2);
        assertEq(uint256(nativeStakingSSVStrategy2.validatorsStates(keccak256(TEST_PUB_KEY_2))), 2);
    }

    function test_FailConsolidation_AllValidators_ResetsState() public {
        _advancePastConsolidationPeriod();

        vm.prank(guardian);
        consolidationController.failConsolidation(sourcePubKeys);

        // All state should be reset
        assertEq(consolidationController.consolidationCount(), 0);
        assertEq(consolidationController.sourceStrategy(), address(0));
        assertEq(consolidationController.targetPubKeyHash(), bytes32(0));
        assertEq(consolidationController.consolidationStartTimestamp(), 0);

        // All source validators restored to STAKED state
        assertEq(uint256(nativeStakingSSVStrategy2.validatorsStates(keccak256(TEST_PUB_KEY_1))), 2);
        assertEq(uint256(nativeStakingSSVStrategy2.validatorsStates(keccak256(TEST_PUB_KEY_2))), 2);
        assertEq(uint256(nativeStakingSSVStrategy2.validatorsStates(keccak256(TEST_PUB_KEY_3))), 2);
    }
}

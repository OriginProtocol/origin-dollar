// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_ConsolidationController_Shared_Test} from "../shared/Shared.t.sol";

contract Unit_ConsolidationController_RequestConsolidation_Test is Unit_ConsolidationController_Shared_Test {
    function setUp() public override {
        super.setUp();
        _setupForConsolidation();
    }

    //////////////////////////////////////////////////////
    /// --- ACCESS CONTROL
    //////////////////////////////////////////////////////

    function test_RevertWhen_CalledByNonOwner_Registrator() public {
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        // governor is the registrator, not the owner
        vm.deal(governor, 1 ether);
        vm.prank(governor);
        vm.expectRevert("Ownable: caller is not the owner");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY
        );
    }

    function test_RevertWhen_CalledByNonOwner_RandomUser() public {
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        vm.deal(josh, 1 ether);
        vm.prank(josh);
        vm.expectRevert("Ownable: caller is not the owner");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY
        );
    }

    function test_RevertWhen_CalledByNonOwner_Strategist() public {
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        vm.deal(strategist, 1 ether);
        vm.prank(strategist);
        vm.expectRevert("Ownable: caller is not the owner");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY
        );
    }

    //////////////////////////////////////////////////////
    /// --- INPUT VALIDATION
    //////////////////////////////////////////////////////

    function test_RevertWhen_EmptySourceValidators() public {
        bytes[] memory sourcePubKeys = new bytes[](0);

        vm.prank(guardian);
        vm.expectRevert("Empty source validators");
        consolidationController.requestConsolidation{value: 0}(
            address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY
        );

        // State should not change
        assertEq(consolidationController.consolidationCount(), 0);
        assertEq(consolidationController.sourceStrategy(), address(0));
        assertEq(consolidationController.targetPubKeyHash(), bytes32(0));
    }

    function test_RevertWhen_InvalidSourcePubKeyLength() public {
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = INVALID_PUB_KEY; // 32 bytes instead of 48

        vm.deal(guardian, 1 ether);
        vm.prank(guardian);
        vm.expectRevert("Invalid public key");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY
        );
    }

    function test_RevertWhen_InvalidTargetPubKeyLength() public {
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        vm.deal(guardian, 1 ether);
        vm.prank(guardian);
        vm.expectRevert("Invalid public key");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), sourcePubKeys, INVALID_PUB_KEY
        );
    }

    function test_RevertWhen_DuplicateSourceValidators() public {
        bytes[] memory sourcePubKeys = new bytes[](3);
        sourcePubKeys[0] = TEST_PUB_KEY_1;
        sourcePubKeys[1] = TEST_PUB_KEY_2;
        sourcePubKeys[2] = TEST_PUB_KEY_1; // duplicate

        vm.deal(guardian, 1 ether);
        vm.prank(guardian);
        vm.expectRevert("Duplicate source validator");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE * 3}(
            address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY
        );
    }

    function test_RevertWhen_InvalidSourceStrategy() public {
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        vm.deal(guardian, 1 ether);
        vm.prank(guardian);
        vm.expectRevert("Invalid source strategy");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(compoundingStakingSSVStrategy), sourcePubKeys, TARGET_PUB_KEY
        );
    }

    function test_RevertWhen_TargetValidatorNotActive() public {
        // Use a pub key that is not registered on the compounding strategy
        bytes memory unknownPubKey =
            hex"808f0e79b73f968e064ecba2702a65bed93cf46149a69f0e4de921b44eab3fd456a1ca0f082887069e5831e139eb2690";

        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        vm.deal(guardian, 1 ether);
        vm.prank(guardian);
        vm.expectRevert("Target validator not active");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), sourcePubKeys, unknownPubKey
        );
    }

    //////////////////////////////////////////////////////
    /// --- STATE MACHINE
    //////////////////////////////////////////////////////

    function test_RevertWhen_ConsolidationAlreadyInProgress() public {
        // First, start a consolidation
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        vm.deal(guardian, 1 ether);
        _requestConsolidation(address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY);

        assertEq(consolidationController.consolidationCount(), 1);

        // Try to start another consolidation
        bytes[] memory sourcePubKeys2 = new bytes[](1);
        sourcePubKeys2[0] = TEST_PUB_KEY_2;

        vm.prank(guardian);
        vm.expectRevert("Consolidation in progress");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), sourcePubKeys2, TARGET_PUB_KEY
        );
    }

    //////////////////////////////////////////////////////
    /// --- HAPPY PATH
    //////////////////////////////////////////////////////

    function test_RequestConsolidation_SingleValidator() public {
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        vm.deal(guardian, 1 ether);
        _requestConsolidation(address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY);

        // Verify state
        assertEq(consolidationController.consolidationCount(), 1);
        assertEq(consolidationController.sourceStrategy(), address(nativeStakingSSVStrategy2));
        assertEq(consolidationController.targetPubKeyHash(), _hashPubKey(TARGET_PUB_KEY));
        assertGt(consolidationController.consolidationStartTimestamp(), 0);
    }

    function test_RequestConsolidation_MultipleValidators() public {
        bytes[] memory sourcePubKeys = new bytes[](3);
        sourcePubKeys[0] = TEST_PUB_KEY_1;
        sourcePubKeys[1] = TEST_PUB_KEY_2;
        sourcePubKeys[2] = TEST_PUB_KEY_3;

        vm.deal(guardian, 1 ether);
        _requestConsolidation(address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY);

        // Verify state
        assertEq(consolidationController.consolidationCount(), 3);
        assertEq(consolidationController.sourceStrategy(), address(nativeStakingSSVStrategy2));
        assertEq(consolidationController.targetPubKeyHash(), _hashPubKey(TARGET_PUB_KEY));
    }

    function test_RequestConsolidation_FromStrategy3() public {
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        vm.deal(guardian, 1 ether);
        _requestConsolidation(address(nativeStakingSSVStrategy3), sourcePubKeys, TARGET_PUB_KEY);

        assertEq(consolidationController.consolidationCount(), 1);
        assertEq(consolidationController.sourceStrategy(), address(nativeStakingSSVStrategy3));
    }

    function test_RequestConsolidation_SourceValidatorSetToExiting() public {
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        // Verify source is STAKED before
        bytes32 sourcePubKeyHash = keccak256(TEST_PUB_KEY_1);
        assertEq(uint256(nativeStakingSSVStrategy2.validatorsStates(sourcePubKeyHash)), 2); // STAKED

        vm.deal(guardian, 1 ether);
        _requestConsolidation(address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY);

        // Verify source is now EXITING
        assertEq(uint256(nativeStakingSSVStrategy2.validatorsStates(sourcePubKeyHash)), 3); // EXITING
    }
}

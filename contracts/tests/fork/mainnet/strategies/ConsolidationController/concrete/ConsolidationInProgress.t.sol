// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_ConsolidationController_Shared_Test} from "../shared/Shared.t.sol";
import {Cluster} from "contracts/interfaces/ISSVNetwork.sol";
import {
    CompoundingBalanceProofs,
    CompoundingPendingDepositProofs,
    CompoundingValidatorStakeData
} from "contracts/interfaces/strategies/CompoundingStakingTypes.sol";

// solhint-disable max-states-count

/// @title Tests for ConsolidationController when a consolidation is in progress
contract Fork_ConsolidationController_InProgress_Test is Fork_ConsolidationController_Shared_Test {
    bytes[] internal sourceValidators;

    function setUp() public override {
        super.setUp();
        _activateTargetValidators();

        // Set up source validators (first 3 from second cluster)
        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        sourceValidators = new bytes[](3);
        sourceValidators[0] = secondClusterPubKeys[0];
        sourceValidators[1] = secondClusterPubKeys[1];
        sourceValidators[2] = secondClusterPubKeys[2];

        // Advance time and set beacon root before requesting consolidation
        skip(12);
        uint256 currentTimestamp = block.timestamp;
        beaconRoots.setBeaconRoot(currentTimestamp, BEACON_BLOCK_ROOT);

        // Request consolidation
        vm.prank(adminAddr);
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE * sourceValidators.length}(
            address(nativeStakingSSVStrategy2), sourceValidators, ACTIVE_TARGET_PUB_KEY()
        );
    }

    // ---------------------------------------------------------------
    // requestConsolidation (should fail when one is in progress)
    // ---------------------------------------------------------------

    function test_RevertWhen_ActiveConsolidationExists() public {
        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        bytes[] memory newSource = new bytes[](1);
        newSource[0] = secondClusterPubKeys[3];

        vm.prank(adminAddr);
        vm.expectRevert("Consolidation in progress");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), newSource, ACTIVE_TARGET_PUB_KEY()
        );
    }

    // ---------------------------------------------------------------
    // verifyBalances
    // ---------------------------------------------------------------

    function test_VerifyBalancesAfterConsolidationRequested() public {
        CompoundingBalanceProofs memory bProofs = _getBalanceProofs();
        CompoundingPendingDepositProofs memory pdProofs = _getPendingDepositProofs();

        // The snap was taken before consolidation started, so verifyBalances should work
        vm.prank(validatorRegistratorAddr);
        consolidationController.verifyBalances(bProofs, pdProofs);
    }

    function test_VerifyPreExistingSnapBeforeConsolidation() public {
        // Fail the current consolidation first
        skip(MIN_CONSOLIDATION_PERIOD);
        vm.prank(adminAddr);
        consolidationController.failConsolidation(sourceValidators);

        // Take a valid snap first, then request consolidation before delay elapses
        skip(SNAP_DELAY + 12);

        uint256 snapSetupTimestamp = block.timestamp;
        beaconRoots.setBeaconRoot(snapSetupTimestamp, BEACON_BLOCK_ROOT);

        vm.prank(validatorRegistratorAddr);
        consolidationController.snapBalances();

        (, uint64 snappedTimestamp,) = compoundingStakingSSVStrategy.snappedBalance();

        skip(12);

        uint256 currentTimestamp = block.timestamp;
        beaconRoots.setBeaconRoot(currentTimestamp, BEACON_BLOCK_ROOT);

        // Request consolidation (should not re-snap since one was taken recently)
        vm.prank(adminAddr);
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE * sourceValidators.length}(
            address(nativeStakingSSVStrategy2), sourceValidators, ACTIVE_TARGET_PUB_KEY()
        );

        uint64 consolidationStartTimestamp = consolidationController.consolidationStartTimestamp();
        assertTrue(snappedTimestamp < consolidationStartTimestamp, "Snap not before consolidation start");

        CompoundingBalanceProofs memory bProofs = _getBalanceProofs();
        CompoundingPendingDepositProofs memory pdProofs = _getPendingDepositProofs();

        vm.prank(validatorRegistratorAddr);
        consolidationController.verifyBalances(bProofs, pdProofs);
    }

    // ---------------------------------------------------------------
    // snapBalances
    // ---------------------------------------------------------------

    function test_SnapBalancesAfterMinPeriod() public {
        skip(MIN_CONSOLIDATION_PERIOD);
        skip(12 * 40);

        vm.prank(validatorRegistratorAddr);
        consolidationController.snapBalances();
    }

    function test_RevertWhen_SnapBalancesTooSoonDuringConsolidation() public {
        vm.prank(validatorRegistratorAddr);
        vm.expectRevert("Source not withdrawable");
        consolidationController.snapBalances();
    }

    function test_RevertWhen_SnapBalancesNonRegistratorDuringConsolidation() public {
        skip(12 * 40);

        vm.prank(josh);
        vm.expectRevert("Consolidation in progress");
        consolidationController.snapBalances();
    }

    function test_RevertWhen_SnapBalancesDirectOnCompoundingDuringConsolidation() public {
        skip(12 * 40);

        vm.prank(josh);
        vm.expectRevert("Not Registrator");
        compoundingStakingSSVStrategy.snapBalances();
    }

    function test_RevertWhen_VerifyBalanceAfterSnapDuringConsolidation() public {
        skip(MIN_CONSOLIDATION_PERIOD);
        skip(12 * 40);

        vm.prank(validatorRegistratorAddr);
        consolidationController.snapBalances();

        CompoundingBalanceProofs memory bProofs = _getBalanceProofs();
        CompoundingPendingDepositProofs memory pdProofs = _getPendingDepositProofs();

        vm.prank(validatorRegistratorAddr);
        vm.expectRevert("Consolidation in progress");
        consolidationController.verifyBalances(bProofs, pdProofs);
    }

    // ---------------------------------------------------------------
    // failConsolidation
    // ---------------------------------------------------------------

    function test_RevertWhen_FailConsolidationBeforeMinPeriod() public {
        bytes[] memory pks = new bytes[](1);
        pks[0] = sourceValidators[0];

        vm.prank(adminAddr);
        vm.expectRevert("Source not withdrawable");
        consolidationController.failConsolidation(pks);
    }

    function test_FailConsolidationSingleValidator() public {
        skip(MIN_CONSOLIDATION_PERIOD);

        uint64 consolidationCountBefore = consolidationController.consolidationCount();
        assertEq(consolidationCountBefore, 3, "Count not 3");

        bytes[] memory pks = new bytes[](1);
        pks[0] = sourceValidators[0];

        vm.prank(adminAddr);
        consolidationController.failConsolidation(pks);

        assertEq(consolidationController.consolidationCount(), consolidationCountBefore - 1, "Count not decremented");
        assertEq(
            consolidationController.sourceStrategy(), address(nativeStakingSSVStrategy2), "Source strategy changed"
        );

        // Source validator post-conditions: back to STAKED (2)
        assertEq(
            uint256(nativeStakingSSVStrategy2.validatorsStates(keccak256(sourceValidators[0]))),
            2,
            "Validator not back to STAKED"
        );
    }

    function test_FailConsolidationMultipleValidators() public {
        skip(MIN_CONSOLIDATION_PERIOD);

        uint64 consolidationCountBefore = consolidationController.consolidationCount();
        assertEq(consolidationCountBefore, 3, "Count not 3");

        bytes[] memory failedValidators = new bytes[](2);
        failedValidators[0] = sourceValidators[0];
        failedValidators[1] = sourceValidators[1];

        vm.prank(adminAddr);
        consolidationController.failConsolidation(failedValidators);

        assertEq(
            consolidationController.consolidationCount(),
            consolidationCountBefore - uint64(failedValidators.length),
            "Count mismatch"
        );
        assertEq(
            consolidationController.sourceStrategy(), address(nativeStakingSSVStrategy2), "Source strategy changed"
        );
        assertTrue(consolidationController.targetPubKeyHash() != bytes32(0), "Target cleared unexpectedly");

        // Source validator post-conditions
        assertEq(
            uint256(nativeStakingSSVStrategy2.validatorsStates(keccak256(sourceValidators[1]))),
            2,
            "Validator not back to STAKED"
        );
    }

    function test_FailConsolidationAllValidatorsResetsState() public {
        skip(MIN_CONSOLIDATION_PERIOD);

        uint64 consolidationCountBefore = consolidationController.consolidationCount();
        assertEq(consolidationCountBefore, 3, "Count not 3");

        vm.prank(adminAddr);
        consolidationController.failConsolidation(sourceValidators);

        assertEq(consolidationController.consolidationCount(), 0, "Count not 0");
        assertEq(consolidationController.sourceStrategy(), address(0), "Source not zero");
        assertEq(consolidationController.targetPubKeyHash(), bytes32(0), "Target not zero");
    }

    function test_RevertWhen_FailConsolidationNotAdmin() public {
        bytes[] memory pks = new bytes[](1);
        pks[0] = sourceValidators[0];

        address[3] memory users = [validatorRegistratorAddr, josh, nick];

        for (uint256 i = 0; i < users.length; i++) {
            vm.prank(users[i]);
            vm.expectRevert("Ownable: caller is not the owner");
            consolidationController.failConsolidation(pks);
        }
    }

    function test_RevertWhen_FailConsolidationInvalidPublicKey() public {
        bytes memory invalidValidatorPubKey = hex"0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";

        skip(MIN_CONSOLIDATION_PERIOD);

        bytes[] memory pks = new bytes[](1);
        pks[0] = invalidValidatorPubKey;

        vm.prank(adminAddr);
        vm.expectRevert("Invalid public key");
        consolidationController.failConsolidation(pks);
    }

    function test_RevertWhen_FailConsolidationUnknownSource() public {
        bytes memory unknownValidatorPubKey =
            hex"808f0e79b73f968e064ecba2702a65bed93cf46149a69f0e4de921b44eab3fd456a1ca0f082887069e5831e139eb2690";

        skip(MIN_CONSOLIDATION_PERIOD);

        bytes[] memory pks = new bytes[](1);
        pks[0] = unknownValidatorPubKey;

        vm.prank(adminAddr);
        vm.expectRevert("Unknown source validator");
        consolidationController.failConsolidation(pks);
    }

    // ---------------------------------------------------------------
    // stakeEth (should fail for consolidation target)
    // ---------------------------------------------------------------

    function test_RevertWhen_StakeToConsolidationTarget() public {
        uint64 depositGwei = 3e9; // 3 ETH in Gwei

        bytes memory emptySignature = new bytes(96);

        // Use a dummy deposit data root (will fail before the root is checked)
        CompoundingValidatorStakeData memory stakeData = CompoundingValidatorStakeData({
            pubkey: ACTIVE_TARGET_PUB_KEY(), signature: emptySignature, depositDataRoot: bytes32(0)
        });

        vm.prank(validatorRegistratorAddr);
        vm.expectRevert("Stake to consolidation target");
        consolidationController.stakeEth(stakeData, depositGwei);
    }

    // ---------------------------------------------------------------
    // confirmConsolidation
    // ---------------------------------------------------------------

    function test_RevertWhen_ConfirmConsolidationTooSoon() public {
        CompoundingBalanceProofs memory bProofs = _getBalanceProofs();
        CompoundingPendingDepositProofs memory pdProofs = _getPendingDepositProofs();

        vm.prank(adminAddr);
        vm.expectRevert("Source not withdrawable");
        consolidationController.confirmConsolidation(bProofs, pdProofs);
    }

    // ---------------------------------------------------------------
    // removeSsvValidator (during consolidation)
    // ---------------------------------------------------------------

    function test_RevertWhen_RemoveValidatorDuringConsolidation() public {
        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        Cluster memory emptyCluster = _getEmptyCluster();

        vm.prank(validatorRegistratorAddr);
        vm.expectRevert("Consolidation in progress");
        consolidationController.removeSsvValidator(
            address(nativeStakingSSVStrategy2), secondClusterPubKeys[0], _getSecondClusterOperatorIds(), emptyCluster
        );
    }

    function test_RemoveValidatorFromNonConsolidatingStrategy() public {
        bytes[] memory thirdClusterPubKeys = _getThirdClusterPubKeys();

        // Note: Both exitSsvValidator and removeSsvValidator may revert with SSV-level errors
        // (e.g. IncorrectValidatorStateWithData) since the on-chain validator state may have
        // changed. This test verifies the access control logic primarily — neither call should
        // revert with "Consolidation in progress" since strategy3 is not the consolidating source.

        // Exit first
        vm.prank(validatorRegistratorAddr);
        try consolidationController.exitSsvValidator(
            address(nativeStakingSSVStrategy3), thirdClusterPubKeys[0], _getThirdClusterOperatorIds()
        ) {
        // Success - validator exit initiated
        }
        catch (bytes memory reason) {
            assertTrue(
                keccak256(reason) != keccak256(abi.encodeWithSignature("Error(string)", "Consolidation in progress")),
                "Should not revert with 'Consolidation in progress'"
            );
            // SSV-level error, skip the remove step
            return;
        }

        // For the Foundry fork test, we use the empty cluster since the SSV API is not available.
        Cluster memory emptyCluster = _getEmptyCluster();

        vm.prank(validatorRegistratorAddr);
        try consolidationController.removeSsvValidator(
            address(nativeStakingSSVStrategy3), thirdClusterPubKeys[0], _getThirdClusterOperatorIds(), emptyCluster
        ) {
        // Success - validator removed
        }
        catch (bytes memory reason) {
            assertTrue(
                keccak256(reason) != keccak256(abi.encodeWithSignature("Error(string)", "Consolidation in progress")),
                "Should not revert with 'Consolidation in progress'"
            );
        }
    }
}

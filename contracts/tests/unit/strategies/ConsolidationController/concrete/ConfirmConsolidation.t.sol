// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_ConsolidationController_Shared_Test} from "../shared/Shared.t.sol";
import {CompoundingValidatorManager} from "contracts/strategies/NativeStaking/CompoundingValidatorManager.sol";

contract Unit_ConsolidationController_ConfirmConsolidation_Test is Unit_ConsolidationController_Shared_Test {
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
        vm.prank(governor);
        vm.expectRevert("Ownable: caller is not the owner");
        consolidationController.confirmConsolidation(_emptyBalanceProofs(0), _emptyPendingDepositProofs(0));
    }

    function test_RevertWhen_CalledByNonOwner_RandomUser() public {
        vm.prank(josh);
        vm.expectRevert("Ownable: caller is not the owner");
        consolidationController.confirmConsolidation(_emptyBalanceProofs(0), _emptyPendingDepositProofs(0));
    }

    function test_RevertWhen_CalledByNonOwner_Strategist() public {
        vm.prank(strategist);
        vm.expectRevert("Ownable: caller is not the owner");
        consolidationController.confirmConsolidation(_emptyBalanceProofs(0), _emptyPendingDepositProofs(0));
    }

    //////////////////////////////////////////////////////
    /// --- STATE CHECKS
    //////////////////////////////////////////////////////

    function test_RevertWhen_NoConsolidationInProgress() public {
        // Fail all to reset state
        _advancePastConsolidationPeriod();
        vm.prank(guardian);
        consolidationController.failConsolidation(sourcePubKeys);

        // Now try confirm - should fail
        vm.prank(guardian);
        vm.expectRevert("No consolidation in progress");
        consolidationController.confirmConsolidation(_emptyBalanceProofs(0), _emptyPendingDepositProofs(0));
    }

    function test_RevertWhen_TooSoon() public {
        // Don't advance time - should fail because snapped timestamp is not past the consolidation period
        vm.prank(guardian);
        vm.expectRevert("Source not withdrawable");
        consolidationController.confirmConsolidation(_emptyBalanceProofs(0), _emptyPendingDepositProofs(0));
    }

    function test_RevertWhen_ConfirmTwice() public {
        _advancePastConsolidationPeriod();

        // Need to snap balances and have snapped timestamp > consolidationStartTimestamp + MIN_CONSOLIDATION_PERIOD
        vm.warp(block.timestamp + SNAP_BALANCES_DELAY + 1);

        vm.prank(governor);
        consolidationController.snapBalances();

        uint256 verifiedCount = compoundingStakingSSVStrategy.verifiedValidatorsLength();
        uint256 depositCount = compoundingStakingSSVStrategy.depositListLength();

        CompoundingValidatorManager.BalanceProofs memory balProofs = _emptyBalanceProofs(verifiedCount);
        CompoundingValidatorManager.PendingDepositProofs memory pendingProofs = _emptyPendingDepositProofs(depositCount);

        // First confirm succeeds
        vm.prank(guardian);
        consolidationController.confirmConsolidation(balProofs, pendingProofs);

        // Second confirm fails
        vm.prank(guardian);
        vm.expectRevert("No consolidation in progress");
        consolidationController.confirmConsolidation(balProofs, pendingProofs);
    }

    //////////////////////////////////////////////////////
    /// --- HAPPY PATH
    //////////////////////////////////////////////////////

    function test_ConfirmConsolidation_ResetsState() public {
        _advancePastConsolidationPeriod();

        // Snap balances (required: snapped timestamp must be after consolidationStartTimestamp + MIN_CONSOLIDATION_PERIOD)
        vm.warp(block.timestamp + SNAP_BALANCES_DELAY + 1);

        vm.prank(governor);
        consolidationController.snapBalances();

        uint256 verifiedCount = compoundingStakingSSVStrategy.verifiedValidatorsLength();
        uint256 depositCount = compoundingStakingSSVStrategy.depositListLength();

        CompoundingValidatorManager.BalanceProofs memory balProofs = _emptyBalanceProofs(verifiedCount);
        CompoundingValidatorManager.PendingDepositProofs memory pendingProofs = _emptyPendingDepositProofs(depositCount);

        uint256 activeValidatorsBefore = nativeStakingSSVStrategy2.activeDepositedValidators();

        vm.prank(guardian);
        consolidationController.confirmConsolidation(balProofs, pendingProofs);

        // All state should be reset
        assertEq(consolidationController.consolidationCount(), 0);
        assertEq(consolidationController.sourceStrategy(), address(0));
        assertEq(consolidationController.targetPubKeyHash(), bytes32(0));
        assertEq(consolidationController.consolidationStartTimestamp(), 0);

        // Active deposited validators on old strategy should be reduced
        assertEq(nativeStakingSSVStrategy2.activeDepositedValidators(), activeValidatorsBefore - 3);
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_ConsolidationController_Shared_Test} from "../shared/Shared.t.sol";
import {Cluster} from "contracts/interfaces/ISSVNetwork.sol";
import {CompoundingValidatorStakeData} from "contracts/interfaces/strategies/CompoundingStakingTypes.sol";

contract Unit_ConsolidationController_Operations_Test is Unit_ConsolidationController_Shared_Test {
    function setUp() public override {
        super.setUp();
        _setupForConsolidation();
    }

    //////////////////////////////////////////////////////
    /// --- doAccounting
    //////////////////////////////////////////////////////

    function test_DoAccounting_ForStrategy2() public {
        vm.prank(governor);
        consolidationController.doAccounting(address(nativeStakingSSVStrategy2));
    }

    function test_DoAccounting_ForStrategy3() public {
        vm.prank(governor);
        consolidationController.doAccounting(address(nativeStakingSSVStrategy3));
    }

    function test_RevertWhen_DoAccounting_CalledByNonRegistrator() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not the Registrator");
        consolidationController.doAccounting(address(nativeStakingSSVStrategy2));
    }

    function test_RevertWhen_DoAccounting_InvalidSourceStrategy() public {
        vm.prank(governor);
        vm.expectRevert("Invalid source strategy");
        consolidationController.doAccounting(address(compoundingStakingSSVStrategy));
    }

    function test_RevertWhen_DoAccounting_DirectlyOnOldStrategy() public {
        // Old strategy registrator is now the ConsolidationController
        // so direct calls from governor should fail
        vm.prank(governor);
        vm.expectRevert("Caller is not the Registrator");
        nativeStakingSSVStrategy2.doAccounting();

        vm.prank(governor);
        vm.expectRevert("Caller is not the Registrator");
        nativeStakingSSVStrategy3.doAccounting();
    }

    //////////////////////////////////////////////////////
    /// --- exitSsvValidator
    //////////////////////////////////////////////////////

    function test_ExitSsvValidator_FromStrategy2() public {
        vm.prank(governor);
        consolidationController.exitSsvValidator(address(nativeStakingSSVStrategy2), TEST_PUB_KEY_1, _operatorIds());

        // Verify state changed to EXITING
        bytes32 pubKeyHash = keccak256(TEST_PUB_KEY_1);
        assertEq(uint256(nativeStakingSSVStrategy2.validatorsStates(pubKeyHash)), 3); // EXITING
    }

    function test_ExitSsvValidator_FromStrategy3() public {
        vm.prank(governor);
        consolidationController.exitSsvValidator(address(nativeStakingSSVStrategy3), TEST_PUB_KEY_1, _operatorIds());

        bytes32 pubKeyHash = keccak256(TEST_PUB_KEY_1);
        assertEq(uint256(nativeStakingSSVStrategy3.validatorsStates(pubKeyHash)), 3); // EXITING
    }

    function test_RevertWhen_ExitSsvValidator_CalledByNonRegistrator() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not the Registrator");
        consolidationController.exitSsvValidator(address(nativeStakingSSVStrategy2), TEST_PUB_KEY_1, _operatorIds());
    }

    function test_RevertWhen_ExitSsvValidator_InvalidSourceStrategy() public {
        vm.prank(governor);
        vm.expectRevert("Invalid source strategy");
        consolidationController.exitSsvValidator(address(compoundingStakingSSVStrategy), TEST_PUB_KEY_1, _operatorIds());
    }

    function test_RevertWhen_ExitSsvValidator_DirectlyOnOldStrategy() public {
        vm.prank(governor);
        vm.expectRevert("Caller is not the Registrator");
        nativeStakingSSVStrategy2.exitSsvValidator(TEST_PUB_KEY_1, _operatorIds());

        vm.prank(governor);
        vm.expectRevert("Caller is not the Registrator");
        nativeStakingSSVStrategy3.exitSsvValidator(TEST_PUB_KEY_1, _operatorIds());
    }

    //////////////////////////////////////////////////////
    /// --- removeSsvValidator (no consolidation in progress)
    //////////////////////////////////////////////////////

    function test_RemoveSsvValidator_WhenNoConsolidation() public {
        // Exit the validator first
        vm.prank(governor);
        consolidationController.exitSsvValidator(address(nativeStakingSSVStrategy2), TEST_PUB_KEY_1, _operatorIds());

        // Remove it
        vm.prank(governor);
        consolidationController.removeSsvValidator(
            address(nativeStakingSSVStrategy2), TEST_PUB_KEY_1, _operatorIds(), _emptyCluster()
        );

        // Verify state changed to EXIT_COMPLETE
        bytes32 pubKeyHash = keccak256(TEST_PUB_KEY_1);
        assertEq(uint256(nativeStakingSSVStrategy2.validatorsStates(pubKeyHash)), 4); // EXIT_COMPLETE
    }

    function test_RevertWhen_RemoveSsvValidator_CalledByNonRegistrator() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not the Registrator");
        consolidationController.removeSsvValidator(
            address(nativeStakingSSVStrategy2), TEST_PUB_KEY_1, _operatorIds(), _emptyCluster()
        );
    }

    function test_RevertWhen_RemoveSsvValidator_InvalidSourceStrategy() public {
        vm.prank(governor);
        vm.expectRevert("Invalid source strategy");
        consolidationController.removeSsvValidator(
            address(compoundingStakingSSVStrategy), TEST_PUB_KEY_1, _operatorIds(), _emptyCluster()
        );
    }

    function test_RevertWhen_RemoveSsvValidator_DirectlyOnOldStrategy() public {
        vm.prank(governor);
        vm.expectRevert("Caller is not the Registrator");
        nativeStakingSSVStrategy2.removeSsvValidator(TEST_PUB_KEY_1, _operatorIds(), _emptyCluster());

        vm.prank(governor);
        vm.expectRevert("Caller is not the Registrator");
        nativeStakingSSVStrategy3.removeSsvValidator(TEST_PUB_KEY_1, _operatorIds(), _emptyCluster());
    }

    //////////////////////////////////////////////////////
    /// --- removeSsvValidator (consolidation in progress)
    //////////////////////////////////////////////////////

    function test_RevertWhen_RemoveSsvValidator_ConsolidationInProgress_SameStrategy() public {
        // Start consolidation from strategy 2
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        vm.deal(guardian, 1 ether);
        _requestConsolidation(address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY);

        // Try to remove from strategy 2 (the one being consolidated) - should fail
        vm.prank(governor);
        vm.expectRevert("Consolidation in progress");
        consolidationController.removeSsvValidator(
            address(nativeStakingSSVStrategy2), TEST_PUB_KEY_2, _operatorIds(), _emptyCluster()
        );
    }

    function test_RemoveSsvValidator_ConsolidationInProgress_DifferentStrategy() public {
        // Start consolidation from strategy 2
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        vm.deal(guardian, 1 ether);
        _requestConsolidation(address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY);

        // Exit a validator from strategy 3 (not being consolidated)
        vm.prank(governor);
        consolidationController.exitSsvValidator(address(nativeStakingSSVStrategy3), TEST_PUB_KEY_1, _operatorIds());

        // Remove from strategy 3 should succeed (different source strategy)
        vm.prank(governor);
        consolidationController.removeSsvValidator(
            address(nativeStakingSSVStrategy3), TEST_PUB_KEY_1, _operatorIds(), _emptyCluster()
        );
    }

    //////////////////////////////////////////////////////
    /// --- snapBalances (no consolidation in progress)
    //////////////////////////////////////////////////////

    function test_SnapBalances_ByAnyone_WhenNoConsolidation() public {
        vm.warp(block.timestamp + SNAP_BALANCES_DELAY + 1);

        vm.prank(josh);
        consolidationController.snapBalances();
    }

    function test_SnapBalances_ByRegistrator_WhenNoConsolidation() public {
        vm.warp(block.timestamp + SNAP_BALANCES_DELAY + 1);

        vm.prank(governor);
        consolidationController.snapBalances();
    }

    //////////////////////////////////////////////////////
    /// --- snapBalances (consolidation in progress)
    //////////////////////////////////////////////////////

    function test_RevertWhen_SnapBalances_ByNonRegistrator_DuringConsolidation() public {
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        vm.deal(guardian, 1 ether);
        _requestConsolidation(address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY);

        vm.warp(block.timestamp + SNAP_BALANCES_DELAY + 1);

        vm.prank(josh);
        vm.expectRevert("Consolidation in progress");
        consolidationController.snapBalances();
    }

    function test_RevertWhen_SnapBalances_TooSoon_DuringConsolidation() public {
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        vm.deal(guardian, 1 ether);
        _requestConsolidation(address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY);

        // Registrator but before MIN_CONSOLIDATION_PERIOD
        vm.prank(governor);
        vm.expectRevert("Source not withdrawable");
        consolidationController.snapBalances();
    }

    function test_SnapBalances_ByRegistrator_AfterConsolidationPeriod() public {
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        vm.deal(guardian, 1 ether);
        _requestConsolidation(address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY);

        _advancePastConsolidationPeriod();
        vm.warp(block.timestamp + SNAP_BALANCES_DELAY + 1);

        vm.prank(governor);
        consolidationController.snapBalances();
    }

    //////////////////////////////////////////////////////
    /// --- validatorWithdrawal
    //////////////////////////////////////////////////////

    function test_RevertWhen_ValidatorWithdrawal_ZeroAmount() public {
        vm.deal(governor, 1 ether);
        vm.prank(governor);
        vm.expectRevert("No exit during migration");
        consolidationController.validatorWithdrawal{value: CONSOLIDATION_FEE}(TARGET_PUB_KEY, 0);
    }

    function test_RevertWhen_ValidatorWithdrawal_CalledByNonRegistrator() public {
        vm.deal(josh, 1 ether);
        vm.prank(josh);
        vm.expectRevert("Caller is not the Registrator");
        consolidationController.validatorWithdrawal{value: CONSOLIDATION_FEE}(TARGET_PUB_KEY, 1);
    }

    function test_ValidatorWithdrawal_PartialWithdrawal() public {
        uint64 withdrawAmount = 2e9; // 2 gwei = 2 ETH in gwei

        vm.deal(governor, 1 ether);
        vm.prank(governor);
        consolidationController.validatorWithdrawal{value: CONSOLIDATION_FEE}(TARGET_PUB_KEY, withdrawAmount);
    }

    //////////////////////////////////////////////////////
    /// --- stakeEth
    //////////////////////////////////////////////////////

    function test_RevertWhen_StakeEth_CalledByNonRegistrator() public {
        CompoundingValidatorStakeData memory stakeData = CompoundingValidatorStakeData({
            pubkey: TARGET_PUB_KEY, signature: TEST_SIGNATURE, depositDataRoot: TEST_DEPOSIT_DATA_ROOT
        });

        vm.prank(josh);
        vm.expectRevert("Caller is not the Registrator");
        consolidationController.stakeEth(stakeData, 1e9);
    }

    function test_RevertWhen_StakeEth_ToConsolidationTarget() public {
        // Start consolidation
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        vm.deal(guardian, 1 ether);
        _requestConsolidation(address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY);

        // Try to stake to the target validator
        CompoundingValidatorStakeData memory stakeData = CompoundingValidatorStakeData({
            pubkey: TARGET_PUB_KEY, signature: TEST_SIGNATURE, depositDataRoot: TEST_DEPOSIT_DATA_ROOT
        });

        vm.prank(governor);
        vm.expectRevert("Stake to consolidation target");
        consolidationController.stakeEth(stakeData, 3e9);
    }

    //////////////////////////////////////////////////////
    /// --- exitSsvValidator during consolidation
    //////////////////////////////////////////////////////

    function test_ExitSsvValidator_DuringConsolidation_AllowedOnSameStrategy() public {
        // Start consolidation from strategy 2
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        vm.deal(guardian, 1 ether);
        _requestConsolidation(address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY);

        // Exiting validators is allowed during consolidation (unlike removing)
        vm.prank(governor);
        consolidationController.exitSsvValidator(address(nativeStakingSSVStrategy2), TEST_PUB_KEY_2, _operatorIds());

        bytes32 pubKeyHash = keccak256(TEST_PUB_KEY_2);
        assertEq(uint256(nativeStakingSSVStrategy2.validatorsStates(pubKeyHash)), 3); // EXITING
    }

    function test_ExitSsvValidator_DuringConsolidation_AllowedOnOtherStrategy() public {
        // Start consolidation from strategy 2
        bytes[] memory sourcePubKeys = new bytes[](1);
        sourcePubKeys[0] = TEST_PUB_KEY_1;

        vm.deal(guardian, 1 ether);
        _requestConsolidation(address(nativeStakingSSVStrategy2), sourcePubKeys, TARGET_PUB_KEY);

        // Exit from strategy 3 is also allowed
        vm.prank(governor);
        consolidationController.exitSsvValidator(address(nativeStakingSSVStrategy3), TEST_PUB_KEY_1, _operatorIds());

        bytes32 pubKeyHash = keccak256(TEST_PUB_KEY_1);
        assertEq(uint256(nativeStakingSSVStrategy3.validatorsStates(pubKeyHash)), 3); // EXITING
    }
}

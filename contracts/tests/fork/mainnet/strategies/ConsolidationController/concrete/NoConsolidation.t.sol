// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_ConsolidationController_Shared_Test} from "../shared/Shared.t.sol";
import {Cluster} from "contracts/interfaces/ISSVNetwork.sol";
import {
    CompoundingBalanceProofs,
    CompoundingPendingDepositProofs,
    CompoundingValidatorState
} from "contracts/interfaces/strategies/CompoundingStakingTypes.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

// solhint-disable max-states-count

/// @title Tests for ConsolidationController when no consolidation is in progress
contract Fork_ConsolidationController_NoConsolidation_Test is Fork_ConsolidationController_Shared_Test {
    function setUp() public override {
        super.setUp();
        _activateTargetValidators();
    }

    // ---------------------------------------------------------------
    // requestConsolidation
    // ---------------------------------------------------------------

    function test_RequestConsolidation_SingleValidator() public {
        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        bytes[] memory sourceValidators = new bytes[](1);
        sourceValidators[0] = secondClusterPubKeys[0];

        // Source validator pre-conditions: STAKED state (2)
        assertEq(
            uint256(nativeStakingSSVStrategy2.validatorsStates(keccak256(sourceValidators[0]))),
            2,
            "Source validator not STAKED"
        );

        // Target validator pre-conditions: Active state (4)
        bytes32 targetPubKeyHash = _hashPubKey(ACTIVE_TARGET_PUB_KEY());
        (CompoundingValidatorState state,) = compoundingStakingSSVStrategy.validator(targetPubKeyHash);
        assertEq(uint256(state), 4, "Target validator not Active");

        vm.prank(adminAddr);
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), sourceValidators, ACTIVE_TARGET_PUB_KEY()
        );

        // Source validator post-conditions: EXITING state (3)
        assertEq(
            uint256(nativeStakingSSVStrategy2.validatorsStates(keccak256(sourceValidators[0]))),
            3,
            "Source validator not EXITING"
        );
    }

    function test_RequestConsolidation_MultipleValidators() public {
        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        bytes[] memory sourceValidators = new bytes[](2);
        sourceValidators[0] = secondClusterPubKeys[0];
        sourceValidators[1] = secondClusterPubKeys[1];

        // Source validator pre-conditions
        assertEq(
            uint256(nativeStakingSSVStrategy2.validatorsStates(keccak256(sourceValidators[1]))),
            2,
            "Source validator not STAKED"
        );

        vm.prank(adminAddr);
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE * sourceValidators.length}(
            address(nativeStakingSSVStrategy2), sourceValidators, ACTIVE_TARGET_PUB_KEY()
        );

        // Both should be EXITING (3)
        assertEq(
            uint256(nativeStakingSSVStrategy2.validatorsStates(keccak256(sourceValidators[0]))),
            3,
            "First source not EXITING"
        );
        assertEq(
            uint256(nativeStakingSSVStrategy2.validatorsStates(keccak256(sourceValidators[1]))),
            3,
            "Second source not EXITING"
        );
    }

    function test_RevertWhen_ConsolidationFeeExceedsMsgValue() public {
        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        bytes[] memory sourceValidators = new bytes[](2);
        sourceValidators[0] = secondClusterPubKeys[0];
        sourceValidators[1] = secondClusterPubKeys[1];

        // Get the current consolidation request fee
        (bool success, bytes memory result) = Mainnet.toConsensus_consolidation.staticcall(hex"");
        require(success, "Fee call failed");
        uint256 fee = abi.decode(result, (uint256));

        // Fund the strategy with enough ETH for the consolidation syscall
        vm.deal(address(nativeStakingSSVStrategy2), fee * 2);

        // Only send enough for one request, not two
        vm.prank(adminAddr);
        vm.expectRevert("Insufficient consolidation fee");
        consolidationController.requestConsolidation{value: fee}(
            address(nativeStakingSSVStrategy2), sourceValidators, ACTIVE_TARGET_PUB_KEY()
        );
    }

    function test_RequestConsolidation_ManyValidatorsSecondCluster() public {
        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();

        // Pre-condition: last validator is STAKED
        assertEq(
            uint256(nativeStakingSSVStrategy2.validatorsStates(keccak256(secondClusterPubKeys[37]))),
            2,
            "Last validator not STAKED"
        );

        vm.prank(adminAddr);
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE * secondClusterPubKeys.length}(
            address(nativeStakingSSVStrategy2), secondClusterPubKeys, ACTIVE_TARGET_PUB_KEY()
        );

        // Post-condition: last validator is EXITING
        assertEq(
            uint256(nativeStakingSSVStrategy2.validatorsStates(keccak256(secondClusterPubKeys[37]))),
            3,
            "Last validator not EXITING"
        );
    }

    function test_RequestConsolidation_ManyValidatorsThirdCluster() public {
        bytes[] memory thirdClusterPubKeys = _getThirdClusterPubKeys();

        // Pre-condition: first validator is STAKED
        assertEq(
            uint256(nativeStakingSSVStrategy3.validatorsStates(keccak256(thirdClusterPubKeys[0]))),
            2,
            "Validator not STAKED"
        );

        vm.prank(adminAddr);
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE * thirdClusterPubKeys.length}(
            address(nativeStakingSSVStrategy3), thirdClusterPubKeys, ACTIVE_TARGET_PUB_KEY()
        );

        // Post-condition: first validator is EXITING
        assertEq(
            uint256(nativeStakingSSVStrategy3.validatorsStates(keccak256(thirdClusterPubKeys[0]))),
            3,
            "Validator not EXITING"
        );
    }

    function test_SkipSnapBalancesWhenRecentSnapExists() public {
        // SNAP_BALANCES_DELAY = 35 * 12 = 420 seconds
        // Advance enough time for an initial snap to succeed
        skip(SNAP_DELAY + 12);
        vm.prank(validatorRegistratorAddr);
        consolidationController.snapBalances();

        // Record the timestamp of that snap
        (, uint64 timestampBefore,) = compoundingStakingSSVStrategy.snappedBalance();

        // Advance only a few slots -- still within SNAP_BALANCES_DELAY
        skip(5 * 12); // 5 slots = 60 seconds

        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        bytes[] memory sourceValidators = new bytes[](1);
        sourceValidators[0] = secondClusterPubKeys[0];

        // requestConsolidation should succeed without emitting BalancesSnapped
        vm.prank(adminAddr);
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), sourceValidators, ACTIVE_TARGET_PUB_KEY()
        );

        (, uint64 timestampAfter,) = compoundingStakingSSVStrategy.snappedBalance();
        assertEq(timestampAfter, timestampBefore, "Snap timestamp changed");
        assertEq(consolidationController.consolidationCount(), 1, "Consolidation count mismatch");
    }

    function test_RevertWhen_DuplicateSourceValidators() public {
        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        bytes[] memory sourceValidators = new bytes[](3);
        sourceValidators[0] = secondClusterPubKeys[0];
        sourceValidators[1] = secondClusterPubKeys[1];
        sourceValidators[2] = secondClusterPubKeys[0]; // duplicate

        vm.prank(adminAddr);
        vm.expectRevert("Duplicate source validator");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE * sourceValidators.length}(
            address(nativeStakingSSVStrategy2), sourceValidators, ACTIVE_TARGET_PUB_KEY()
        );
    }

    function test_RevertWhen_EmptySourceValidators() public {
        bytes[] memory sourceValidators = new bytes[](0);

        vm.prank(adminAddr);
        vm.expectRevert("Empty source validators");
        consolidationController.requestConsolidation{value: 0}(
            address(nativeStakingSSVStrategy2), sourceValidators, ACTIVE_TARGET_PUB_KEY()
        );

        assertEq(consolidationController.consolidationCount(), 0, "Count not 0");
        assertEq(consolidationController.sourceStrategy(), address(0), "Source not zero");
        assertEq(consolidationController.targetPubKeyHash(), bytes32(0), "Target not zero");
    }

    function test_RevertWhen_SourceValidatorIsExiting() public {
        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        bytes memory exitedValidatorPubKey = secondClusterPubKeys[0];

        // Exit the validator first. May revert with SSV-level error if the validator
        // has already been exited on-chain; in that case, set state directly.
        vm.prank(validatorRegistratorAddr);
        try consolidationController.exitSsvValidator(
            address(nativeStakingSSVStrategy2), exitedValidatorPubKey, _getSecondClusterOperatorIds()
        ) {
        // Success
        }
        catch {
            // SSV-level error — set state to EXITING (3) directly via vm.store
            bytes32 pubKeyHash = keccak256(exitedValidatorPubKey);
            bytes32 slot = keccak256(abi.encode(pubKeyHash, uint256(53)));
            vm.store(address(nativeStakingSSVStrategy2), slot, bytes32(uint256(3)));
        }

        // Confirm it is EXITING
        assertEq(
            uint256(nativeStakingSSVStrategy2.validatorsStates(keccak256(exitedValidatorPubKey))), 3, "Not EXITING"
        );

        bytes[] memory sourceValidators = new bytes[](1);
        sourceValidators[0] = exitedValidatorPubKey;

        vm.prank(adminAddr);
        vm.expectRevert("Source validator not staked");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), sourceValidators, ACTIVE_TARGET_PUB_KEY()
        );
    }

    function test_RevertWhen_SourceValidatorIsExitedComplete() public {
        bytes memory previouslyExitedValidatorPubKey =
            hex"8db6d9578e01ef6f1e6c655ff094a91d4ae02734d66accbdca8432eaa0b815cee503325f98b8406f2ab372a30d0f9edb";

        // EXITED_COMPLETE state (4)
        assertEq(
            uint256(nativeStakingSSVStrategy2.validatorsStates(keccak256(previouslyExitedValidatorPubKey))),
            4,
            "Not EXITED_COMPLETE"
        );

        bytes[] memory sourceValidators = new bytes[](1);
        sourceValidators[0] = previouslyExitedValidatorPubKey;

        vm.prank(adminAddr);
        vm.expectRevert("Source validator not staked");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), sourceValidators, ACTIVE_TARGET_PUB_KEY()
        );
    }

    function test_RevertWhen_SourceValidatorUnknown() public {
        bytes memory unknownValidatorPubKey =
            hex"808f0e79b73f968e064ecba2702a65bed93cf46149a69f0e4de921b44eab3fd456a1ca0f082887069e5831e139eb2690";

        // UNKNOWN state (0)
        assertEq(
            uint256(nativeStakingSSVStrategy2.validatorsStates(keccak256(unknownValidatorPubKey))), 0, "Not UNKNOWN"
        );

        bytes[] memory sourceValidators = new bytes[](1);
        sourceValidators[0] = unknownValidatorPubKey;

        vm.prank(adminAddr);
        vm.expectRevert("Source validator not staked");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), sourceValidators, ACTIVE_TARGET_PUB_KEY()
        );
    }

    function test_RevertWhen_TargetValidatorUnknown() public {
        bytes memory unknownValidatorPubKey =
            hex"808f0e79b73f968e064ecba2702a65bed93cf46149a69f0e4de921b44eab3fd456a1ca0f082887069e5831e139eb2690";

        // Target validator is UNKNOWN (0)
        bytes32 targetPubKeyHash = _hashPubKey(unknownValidatorPubKey);
        (CompoundingValidatorState state,) = compoundingStakingSSVStrategy.validator(targetPubKeyHash);
        assertEq(uint256(state), 0, "Target not Unknown");

        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        bytes[] memory sourceValidators = new bytes[](1);
        sourceValidators[0] = secondClusterPubKeys[0];

        vm.prank(adminAddr);
        vm.expectRevert("Target validator not active");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), sourceValidators, unknownValidatorPubKey
        );
    }

    function test_RevertWhen_InvalidSourcePublicKey() public {
        // Key only 32 bytes long instead of 48 bytes
        bytes memory invalidValidatorPubKey = hex"0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";

        bytes[] memory sourceValidators = new bytes[](1);
        sourceValidators[0] = invalidValidatorPubKey;

        vm.prank(adminAddr);
        vm.expectRevert("Invalid public key");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), sourceValidators, ACTIVE_TARGET_PUB_KEY()
        );
    }

    function test_RevertWhen_InvalidTargetPublicKey() public {
        bytes memory invalidValidatorPubKey = hex"0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";

        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        bytes[] memory sourceValidators = new bytes[](1);
        sourceValidators[0] = secondClusterPubKeys[0];

        vm.prank(adminAddr);
        vm.expectRevert("Invalid public key");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), sourceValidators, invalidValidatorPubKey
        );
    }

    function test_RevertWhen_TargetValidatorIsStaked() public {
        bytes memory stakedCompoundingValidatorPubKey =
            hex"a4258aa50aba9d7441f734213ae76fad9809572a593765c25c25d7afd42b83baba06397bd9e264a9fa24c3327a308682";

        // Target is in Staked state (2)
        bytes32 targetPubKeyHash = _hashPubKey(stakedCompoundingValidatorPubKey);
        (CompoundingValidatorState state,) = compoundingStakingSSVStrategy.validator(targetPubKeyHash);
        assertEq(uint256(state), 2, "Target not Staked");

        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        bytes[] memory sourceValidators = new bytes[](1);
        sourceValidators[0] = secondClusterPubKeys[0];

        vm.prank(adminAddr);
        vm.expectRevert("Target validator not active");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), sourceValidators, stakedCompoundingValidatorPubKey
        );
    }

    function test_RevertWhen_TargetHasPendingDeposit() public {
        bytes memory activeWithDepositCompoundingValidatorPubKey =
            hex"8427639adf9c746f7d7271ddee3bbcd7a1f3b4beb3bd67224c345d7c7e7cffd58d61d5bc84a3ab7d0f909ebf71da7b8b";

        // Target is Active (4) but has pending deposit
        bytes32 targetPubKeyHash = _hashPubKey(activeWithDepositCompoundingValidatorPubKey);
        (CompoundingValidatorState state,) = compoundingStakingSSVStrategy.validator(targetPubKeyHash);
        assertEq(uint256(state), 4, "Target not Active");

        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        bytes[] memory sourceValidators = new bytes[](1);
        sourceValidators[0] = secondClusterPubKeys[0];

        vm.prank(adminAddr);
        vm.expectRevert("Target has pending deposit");
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
            address(nativeStakingSSVStrategy2), sourceValidators, activeWithDepositCompoundingValidatorPubKey
        );
    }

    function test_RevertWhen_RequestConsolidationNotAdmin() public {
        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        bytes[] memory sourceValidators = new bytes[](1);
        sourceValidators[0] = secondClusterPubKeys[0];

        address[3] memory users = [validatorRegistratorAddr, josh, nick];

        for (uint256 i = 0; i < users.length; i++) {
            vm.expectRevert("Ownable: caller is not the owner");
            vm.prank(users[i]);
            consolidationController.requestConsolidation{value: CONSOLIDATION_FEE}(
                address(nativeStakingSSVStrategy2), sourceValidators, ACTIVE_TARGET_PUB_KEY()
            );
        }
    }

    function test_RevertWhen_RequestConsolidationDirectlyOnStrategy() public {
        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        bytes[] memory sourceValidators = new bytes[](1);
        sourceValidators[0] = secondClusterPubKeys[0];

        address[3] memory users = [adminAddr, validatorRegistratorAddr, josh];

        for (uint256 i = 0; i < users.length; i++) {
            vm.expectRevert("Caller is not the Registrator");
            vm.prank(users[i]);
            nativeStakingSSVStrategy2.requestConsolidation{value: CONSOLIDATION_FEE}(
                sourceValidators, ACTIVE_TARGET_PUB_KEY()
            );
        }
    }

    // ---------------------------------------------------------------
    // failConsolidation (no active consolidation)
    // ---------------------------------------------------------------

    function test_RevertWhen_FailConsolidationNoActive() public {
        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        bytes[] memory pks = new bytes[](1);
        pks[0] = secondClusterPubKeys[0];

        vm.prank(adminAddr);
        vm.expectRevert("No consolidation in progress");
        consolidationController.failConsolidation(pks);
    }

    // ---------------------------------------------------------------
    // snapBalances
    // ---------------------------------------------------------------

    function test_SnapBalancesAnyoneWhenNoConsolidation() public {
        skip(12 * 40);

        vm.prank(josh);
        consolidationController.snapBalances();
        // If we reach here without revert, the test passes
    }

    // ---------------------------------------------------------------
    // verifyBalances
    // ---------------------------------------------------------------

    function test_RevertWhen_DirectVerifyBalanceOnCompoundingStrategy() public {
        skip(12 * 40);
        vm.prank(validatorRegistratorAddr);
        consolidationController.snapBalances();

        CompoundingBalanceProofs memory bProofs = _getBalanceProofs();
        CompoundingPendingDepositProofs memory pdProofs = _getPendingDepositProofs();

        vm.prank(validatorRegistratorAddr);
        vm.expectRevert("Not Registrator");
        compoundingStakingSSVStrategy.verifyBalances(bProofs, pdProofs);
    }

    // ---------------------------------------------------------------
    // doAccounting
    // ---------------------------------------------------------------

    function test_DoAccountingViaController() public {
        vm.prank(validatorRegistratorAddr);
        consolidationController.doAccounting(address(nativeStakingSSVStrategy2));

        vm.prank(validatorRegistratorAddr);
        consolidationController.doAccounting(address(nativeStakingSSVStrategy3));
    }

    function test_RevertWhen_DirectDoAccountingOnStrategies() public {
        vm.prank(validatorRegistratorAddr);
        vm.expectRevert("Caller is not the Registrator");
        nativeStakingSSVStrategy2.doAccounting();

        vm.prank(validatorRegistratorAddr);
        vm.expectRevert("Caller is not the Registrator");
        nativeStakingSSVStrategy3.doAccounting();
    }

    // ---------------------------------------------------------------
    // exitSsvValidator
    // ---------------------------------------------------------------

    function test_ExitSourceValidatorsViaController() public {
        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        bytes[] memory thirdClusterPubKeys = _getThirdClusterPubKeys();

        // Note: exitSsvValidator calls ISSVNetwork.exitValidator() which may revert with
        // IncorrectValidatorStateWithData if the validator has already been exited on-chain.
        // This test verifies the access control (calling via controller works), not SSV state.

        vm.prank(validatorRegistratorAddr);
        try consolidationController.exitSsvValidator(
            address(nativeStakingSSVStrategy2), secondClusterPubKeys[0], _getSecondClusterOperatorIds()
        ) {
        // Success
        }
        catch (bytes memory reason) {
            assertTrue(
                keccak256(reason)
                    != keccak256(abi.encodeWithSignature("Error(string)", "Caller is not the Registrator")),
                "Should not revert with access control error"
            );
        }

        vm.prank(validatorRegistratorAddr);
        try consolidationController.exitSsvValidator(
            address(nativeStakingSSVStrategy3), thirdClusterPubKeys[0], _getThirdClusterOperatorIds()
        ) {
        // Success
        }
        catch (bytes memory reason) {
            assertTrue(
                keccak256(reason)
                    != keccak256(abi.encodeWithSignature("Error(string)", "Caller is not the Registrator")),
                "Should not revert with access control error"
            );
        }
    }

    function test_RevertWhen_DirectExitOnStrategies() public {
        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        bytes[] memory thirdClusterPubKeys = _getThirdClusterPubKeys();

        vm.prank(validatorRegistratorAddr);
        vm.expectRevert("Caller is not the Registrator");
        nativeStakingSSVStrategy2.exitSsvValidator(secondClusterPubKeys[0], _getSecondClusterOperatorIds());

        vm.prank(validatorRegistratorAddr);
        vm.expectRevert("Caller is not the Registrator");
        nativeStakingSSVStrategy3.exitSsvValidator(thirdClusterPubKeys[0], _getThirdClusterOperatorIds());
    }

    // ---------------------------------------------------------------
    // removeSsvValidator
    // ---------------------------------------------------------------

    function test_RevertWhen_DirectRemoveOnStrategies() public {
        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        bytes[] memory thirdClusterPubKeys = _getThirdClusterPubKeys();
        Cluster memory emptyCluster = _getEmptyCluster();

        vm.prank(validatorRegistratorAddr);
        vm.expectRevert("Caller is not the Registrator");
        nativeStakingSSVStrategy2.removeSsvValidator(
            secondClusterPubKeys[0], _getSecondClusterOperatorIds(), emptyCluster
        );

        vm.prank(validatorRegistratorAddr);
        vm.expectRevert("Caller is not the Registrator");
        nativeStakingSSVStrategy3.removeSsvValidator(
            thirdClusterPubKeys[0], _getThirdClusterOperatorIds(), emptyCluster
        );
    }

    // ---------------------------------------------------------------
    // validatorWithdrawal
    // ---------------------------------------------------------------

    function test_PartialWithdrawFromCompoundingValidator() public {
        uint64 withdrawAmount = 2e9; // 2 ETH in Gwei

        vm.prank(validatorRegistratorAddr);
        consolidationController.validatorWithdrawal{value: CONSOLIDATION_FEE}(ACTIVE_TARGET_PUB_KEY(), withdrawAmount);
        // If we reach here without revert, the test passes. The event would be ValidatorWithdraw.
    }

    function test_RevertWhen_FullExitDuringMigration() public {
        vm.prank(validatorRegistratorAddr);
        vm.expectRevert("No exit during migration");
        consolidationController.validatorWithdrawal{value: CONSOLIDATION_FEE}(ACTIVE_TARGET_PUB_KEY(), 0);
    }

    // ---------------------------------------------------------------
    // stakeEth (to compounding validator)
    // ---------------------------------------------------------------

    // NOTE: The stakeEth test requires computing a valid SSZ deposit data root.
    // Since this uses SSZ hashing that is not easily reproducible in Solidity,
    // we skip this specific test in the Foundry migration. The Hardhat test
    // dynamically computes the root via Lodestar SSZ library.

    // ---------------------------------------------------------------
    // removeSsvValidator via controller
    // ---------------------------------------------------------------

    function test_RevertWhen_RemoveValidatorNotRegistrator() public {
        bytes[] memory secondClusterPubKeys = _getSecondClusterPubKeys();
        Cluster memory emptyCluster = _getEmptyCluster();

        vm.prank(josh);
        vm.expectRevert("Caller is not the Registrator");
        consolidationController.removeSsvValidator(
            address(nativeStakingSSVStrategy2), secondClusterPubKeys[0], _getSecondClusterOperatorIds(), emptyCluster
        );
    }
}

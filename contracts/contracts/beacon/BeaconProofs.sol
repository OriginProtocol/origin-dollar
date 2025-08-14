// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconProofsLib, FirstPendingDeposit, FirstPendingDepositValidator } from "./BeaconProofsLib.sol";

/**
 * @title Verifies merkle proofs of beacon chain data.
 * @author Origin Protocol Inc
 */
contract BeaconProofs {
    function verifyState(
        bytes32 beaconBlockRoot,
        bytes32 stateRoot,
        bytes calldata stateProof
    ) external view {
        BeaconProofsLib.verifyState(beaconBlockRoot, stateRoot, stateProof);
    }

    /// @notice Verifies the validator index is for the given validator public key.
    /// Also verify the validator's withdrawal credential points to the withdrawal address.
    /// BeaconBlock.state.validators[validatorIndex].pubkey
    /// BeaconBlock.state.validators[validatorIndex].withdrawalCredentials
    /// @param beaconBlockRoot The root of the beacon block
    /// @param pubKeyHash Hash of validator's public key using the Beacon Chain's format
    /// @param proof The merkle proof for the validator public key to the beacon block root.
    /// This is 53 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    /// @param validatorIndex The validator index
    /// @param withdrawalAddress The withdrawal address used in the validator's withdrawal credentials
    function verifyValidator(
        bytes32 beaconBlockRoot,
        bytes32 pubKeyHash,
        bytes calldata proof,
        uint64 validatorIndex,
        address withdrawalAddress
    ) external view {
        BeaconProofsLib.verifyValidator(
            beaconBlockRoot,
            pubKeyHash,
            proof,
            validatorIndex,
            withdrawalAddress
        );
    }

    /// @notice Verifies the balances container to the beacon state container.
    /// State.balances
    /// @param stateRoot The root of the beacon state.
    /// @param balancesContainerRoot The merkle root of the the balances container.
    /// @param proof The merkle proof for the balances container to the beacon state root.
    /// This is 6 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    function verifyBalancesContainer(
        bytes32 stateRoot,
        bytes32 balancesContainerRoot,
        bytes calldata proof
    ) external view {
        BeaconProofsLib.verifyBalancesContainer(
            stateRoot,
            balancesContainerRoot,
            proof
        );
    }

    /// @notice Verifies the validator balance to the root of the Balances container.
    /// @param balancesContainerRoot The merkle root of the Balances container.
    /// @param validatorBalanceLeaf The leaf node containing the validator balance with three other balances.
    /// @param balanceProof The merkle proof for the validator balance to the Balances container root.
    /// This is 39 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    /// @param validatorIndex The validator index to verify the balance for
    /// @return validatorBalanceGwei The balance in Gwei of the validator at the given index
    function verifyValidatorBalance(
        bytes32 balancesContainerRoot,
        bytes32 validatorBalanceLeaf,
        bytes calldata balanceProof,
        uint64 validatorIndex
    ) external view returns (uint256 validatorBalanceGwei) {
        validatorBalanceGwei = BeaconProofsLib.verifyValidatorBalance(
            balancesContainerRoot,
            validatorBalanceLeaf,
            balanceProof,
            validatorIndex
        );
    }

    /// @notice If the deposit queue is not empty,
    /// verify the slot of the first pending deposit to the beacon block root
    /// BeaconBlock.state.PendingDeposits[0].slot
    /// If the deposit queue is empty, verify the root of the first pending deposit is empty
    /// BeaconBlock.state.PendingDeposits[0]
    function verifyFirstPendingDeposit(
        bytes32 stateRoot,
        FirstPendingDeposit calldata firstPendingDeposit,
        FirstPendingDepositValidator calldata firstPendingDepositValidator
    ) external view returns (bool isEmptyDepositQueue) {
        isEmptyDepositQueue = BeaconProofsLib.verifyFirstPendingDeposit(
            stateRoot,
            firstPendingDeposit,
            firstPendingDepositValidator
        );
    }
}

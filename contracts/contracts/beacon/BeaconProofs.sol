// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconProofsLib } from "./BeaconProofsLib.sol";
import { IBeaconProofs } from "../interfaces/IBeaconProofs.sol";

/**
 * @title Verifies merkle proofs of beacon chain data.
 * @author Origin Protocol Inc
 */
contract BeaconProofs is IBeaconProofs {
    /// @notice Verifies the validator public key to the beacon block root
    /// BeaconBlock.state.validators[validatorIndex].pubkey
    /// @param beaconBlockRoot The root of the beacon block
    /// @param pubKeyHash Hash of validator's public key using the Beacon Chain's format
    /// @param validatorPubKeyProof The merkle proof for the validator public key to the beacon block root.
    /// This is 53 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    /// @param validatorIndex The validator index
    /// @param withdrawalAddress The withdrawal address used in the validator's withdrawal credentials
    function verifyValidator(
        bytes32 beaconBlockRoot,
        bytes32 pubKeyHash,
        bytes calldata validatorPubKeyProof,
        uint64 validatorIndex,
        address withdrawalAddress
    ) external view {
        BeaconProofsLib.verifyValidator(
            beaconBlockRoot,
            pubKeyHash,
            validatorPubKeyProof,
            validatorIndex,
            withdrawalAddress
        );
    }

    function verifyValidatorWithdrawable(
        bytes32 beaconBlockRoot,
        uint64 validatorIndex,
        bytes32 pubKeyHash,
        uint64 withdrawableEpoch,
        bytes calldata withdrawableEpochProof,
        bytes calldata validatorPubKeyProof
    ) external view {
        BeaconProofsLib.verifyValidatorWithdrawableEpoch(
            beaconBlockRoot,
            validatorIndex,
            withdrawableEpoch,
            withdrawableEpochProof
        );

        // Get the third 32 byte witness from the withdrawable epoch proof
        // 2 * 32 bytes = 64 bytes offset
        bytes32 subTreeRoot = bytes32(withdrawableEpochProof[64:96]);

        BeaconProofsLib.verifyValidatorPubKeySubTree(
            subTreeRoot,
            pubKeyHash,
            validatorPubKeyProof
        );
    }

    /// @notice Verifies the balances container to the beacon block root
    /// BeaconBlock.state.balances
    /// @param beaconBlockRoot The root of the beacon block
    /// @param balancesContainerRoot The merkle root of the the balances container
    /// @param balancesContainerProof The merkle proof for the balances container to the beacon block root.
    /// This is 9 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    function verifyBalancesContainer(
        bytes32 beaconBlockRoot,
        bytes32 balancesContainerRoot,
        bytes calldata balancesContainerProof
    ) external view {
        BeaconProofsLib.verifyBalancesContainer(
            beaconBlockRoot,
            balancesContainerRoot,
            balancesContainerProof
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
    /// Verify the pubkey of the first pending deposit to the beacon block root
    /// BeaconBlock.state.PendingDeposits[0].pubkey
    /// If the deposit queue is empty, verify the root of the first pending deposit is empty
    /// BeaconBlock.state.PendingDeposits[0]
    /// @param beaconBlockRoot The root of the beacon block
    /// @param slot The beacon chain slot of the first deposit in the beacon chain's deposit queue.
    /// Can be anything if the deposit queue is empty, but zero would be a good choice.
    /// @param pubKeyHash The hash of the validator public key for the first pending deposit.
    /// Use zero bytes if the deposit queue is empty.
    /// @param firstPendingDepositProof The merkle proof to the beacon block root. Can be either:
    /// - 40 witness hashes for BeaconBlock.state.PendingDeposits[0].pubkey when the deposit queue is not empty.
    /// - 37 witness hashes for BeaconBlock.state.PendingDeposits[0] when the deposit queue is empty.
    /// The 32 byte witness hashes are concatenated together starting from the leaf node.
    /// @return isEmptyDepositQueue True if the deposit queue is empty, false otherwise
    function verifyFirstPendingDeposit(
        bytes32 beaconBlockRoot,
        uint64 slot,
        bytes32 pubKeyHash,
        bytes calldata firstPendingDepositProof
    ) external view returns (bool isEmptyDepositQueue) {
        isEmptyDepositQueue = BeaconProofsLib.verifyFirstPendingDeposit(
            beaconBlockRoot,
            slot,
            pubKeyHash,
            firstPendingDepositProof
        );
    }
}

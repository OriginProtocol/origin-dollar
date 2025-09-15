// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconProofsLib } from "./BeaconProofsLib.sol";
import { IBeaconProofs } from "../interfaces/IBeaconProofs.sol";

/**
 * @title Verifies merkle proofs of beacon chain data.
 * @author Origin Protocol Inc
 */
contract BeaconProofs is IBeaconProofs {
    /// @notice Verifies the validator index is for the given validator public key.
    /// Also verify the validator's withdrawal credential points to the withdrawal address.
    /// BeaconBlock.state.validators[validatorIndex].pubkey
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
        uint40 validatorIndex,
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

    function verifyValidatorWithdrawable(
        bytes32 beaconBlockRoot,
        uint40 validatorIndex,
        uint64 withdrawableEpoch,
        bytes calldata withdrawableEpochProof
    ) external view {
        BeaconProofsLib.verifyValidatorWithdrawableEpoch(
            beaconBlockRoot,
            validatorIndex,
            withdrawableEpoch,
            withdrawableEpochProof
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
        uint40 validatorIndex
    ) external view returns (uint256 validatorBalanceGwei) {
        validatorBalanceGwei = BeaconProofsLib.verifyValidatorBalance(
            balancesContainerRoot,
            validatorBalanceLeaf,
            balanceProof,
            validatorIndex
        );
    }

    /// @notice Verifies the pending deposits container to the beacon block root.
    /// BeaconBlock.state.pendingDeposits
    /// @param beaconBlockRoot The root of the beacon block.
    /// @param pendingDepositsContainerRoot The merkle root of the the pending deposits container.
    /// @param proof The merkle proof for the pending deposits container to the beacon block root.
    /// This is 9 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    function verifyPendingDepositsContainer(
        bytes32 beaconBlockRoot,
        bytes32 pendingDepositsContainerRoot,
        bytes calldata proof
    ) external view {
        BeaconProofsLib.verifyPendingDepositsContainer(
            beaconBlockRoot,
            pendingDepositsContainerRoot,
            proof
        );
    }

    /// @notice Verified a pending deposit to the root of the Pending Deposits container.
    /// @param pendingDepositsContainerRoot The merkle root of the Pending Deposits container.
    /// @param pendingDepositRoot The leaf node containing the validator balance with three other balances.
    /// @param proof The merkle proof for the pending deposit root to the Pending Deposits container root.
    /// This is 28 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    /// @param pendingDepositIndex The pending deposit index in the Pending Deposits container
    function verifyPendingDeposit(
        bytes32 pendingDepositsContainerRoot,
        bytes32 pendingDepositRoot,
        bytes calldata proof,
        uint64 pendingDepositIndex
    ) external view {
        BeaconProofsLib.verifyPendingDeposit(
            pendingDepositsContainerRoot,
            pendingDepositRoot,
            proof,
            pendingDepositIndex
        );
    }

    /// @notice If the deposit queue is not empty,
    /// verify the slot of the first pending deposit to the beacon block root.
    /// BeaconBlock.state.pendingDeposits[0].slot
    /// If the deposit queue is empty, verify the root of the first pending deposit is empty
    /// BeaconBlock.state.PendingDeposits[0]
    /// @param beaconBlockRoot The root of the beacon block.
    /// @param slot The beacon chain slot of the first deposit in the beacon chain's deposit queue.
    /// Can be anything if the deposit queue is empty.
    /// @param firstPendingDepositSlotProof The merkle proof to the beacon block root. Can be either:
    /// - 40 witness hashes for BeaconBlock.state.PendingDeposits[0].slot when the deposit queue is not empty.
    /// - 37 witness hashes for BeaconBlock.state.PendingDeposits[0] when the deposit queue is empty.
    /// The 32 byte witness hashes are concatenated together starting from the leaf node.
    /// @return isEmptyDepositQueue True if the deposit queue is empty, false otherwise.
    function verifyFirstPendingDeposit(
        bytes32 beaconBlockRoot,
        uint64 slot,
        bytes calldata firstPendingDepositSlotProof
    ) external view returns (bool isEmptyDepositQueue) {
        isEmptyDepositQueue = BeaconProofsLib.verifyFirstPendingDeposit(
            beaconBlockRoot,
            slot,
            firstPendingDepositSlotProof
        );
    }

    /// @notice Merkleizes a beacon chain pending deposit.
    /// @param pubKeyHash Hash of validator's public key using the Beacon Chain's format
    /// @param withdrawalCredentials The 32 byte withdrawal credentials.
    /// @param amountGwei The amount of the deposit in Gwei.
    /// @param signature The 96 byte BLS signature.
    /// @param slot The beacon chain slot the deposit was made in.
    /// @return root The merkle root of the pending deposit.
    function merkleizePendingDeposit(
        bytes32 pubKeyHash,
        bytes calldata withdrawalCredentials,
        uint64 amountGwei,
        bytes calldata signature,
        uint64 slot
    ) external pure returns (bytes32) {
        return
            BeaconProofsLib.merkleizePendingDeposit(
                pubKeyHash,
                withdrawalCredentials,
                amountGwei,
                signature,
                slot
            );
    }

    /// @notice Merkleizes a BLS signature used for validator deposits.
    /// @param signature The 96 byte BLS signature.
    /// @return root The merkle root of the signature.
    function merkleizeSignature(bytes calldata signature)
        external
        pure
        returns (bytes32 root)
    {
        return BeaconProofsLib.merkleizeSignature(signature);
    }
}

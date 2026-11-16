// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IBeaconProofs {
    /// @notice Verifies a validator's public key and withdrawal credentials against a beacon block root.
    /// @param beaconBlockRoot Root of the beacon block containing the validator state.
    /// @param pubKeyHash SSZ root of the validator's 48-byte public key.
    /// @param validatorPubKeyProof Concatenated 32-byte sibling hashes, ordered from leaf to root.
    /// @param validatorIndex Index of the validator in the beacon state's validator registry.
    /// @param withdrawalCredentials Expected 32-byte withdrawal credentials.
    function verifyValidator(
        bytes32 beaconBlockRoot,
        bytes32 pubKeyHash,
        bytes calldata validatorPubKeyProof,
        uint40 validatorIndex,
        bytes32 withdrawalCredentials
    ) external view;

    /// @notice Verifies a validator's withdrawable epoch against a beacon block root.
    /// @param beaconBlockRoot Root of the beacon block containing the validator state.
    /// @param validatorIndex Index of the validator in the beacon state's validator registry.
    /// @param withdrawableEpoch Expected epoch at which the validator becomes withdrawable.
    /// @param withdrawableEpochProof Concatenated 32-byte sibling hashes, ordered from leaf to root.
    function verifyValidatorWithdrawable(
        bytes32 beaconBlockRoot,
        uint40 validatorIndex,
        uint64 withdrawableEpoch,
        bytes calldata withdrawableEpochProof
    ) external view;

    /// @notice Verifies the balances list root against a beacon block root.
    /// @param beaconBlockRoot Root of the beacon block containing the balances list.
    /// @param balancesContainerLeaf Expected SSZ root of the balances list.
    /// @param balancesContainerProof Concatenated 32-byte sibling hashes, ordered from leaf to root.
    function verifyBalancesContainer(
        bytes32 beaconBlockRoot,
        bytes32 balancesContainerLeaf,
        bytes calldata balancesContainerProof
    ) external view;

    /// @notice Verifies a validator's balance leaf and extracts its balance.
    /// @param balancesContainerRoot SSZ root of the balances list.
    /// @param validatorBalanceLeaf SSZ chunk containing four little-endian uint64 balances.
    /// @param balanceProof Concatenated 32-byte sibling hashes from the balance chunk to the list root.
    /// @param validatorIndex Validator index used to select the chunk and balance within it.
    /// @return validatorBalance Verified validator balance in Gwei.
    function verifyValidatorBalance(
        bytes32 balancesContainerRoot,
        bytes32 validatorBalanceLeaf,
        bytes calldata balanceProof,
        uint40 validatorIndex
    ) external view returns (uint256 validatorBalance);

    /// @notice Verifies the pending-deposits list root against a beacon block root.
    /// @param beaconBlockRoot Root of the beacon block containing the pending-deposits list.
    /// @param pendingDepositsContainerRoot Expected SSZ root of the pending-deposits list.
    /// @param proof Concatenated 32-byte sibling hashes, ordered from leaf to root.
    function verifyPendingDepositsContainer(
        bytes32 beaconBlockRoot,
        bytes32 pendingDepositsContainerRoot,
        bytes calldata proof
    ) external view;

    /// @notice Verifies a pending-deposit root at a given list index.
    /// @param pendingDepositsContainerRoot SSZ root of the pending-deposits list.
    /// @param pendingDepositRoot Expected SSZ root of the pending deposit.
    /// @param proof Concatenated 32-byte sibling hashes from the deposit root to the list root.
    /// @param pendingDepositIndex Index of the deposit in the pending-deposits list.
    function verifyPendingDeposit(
        bytes32 pendingDepositsContainerRoot,
        bytes32 pendingDepositRoot,
        bytes calldata proof,
        uint32 pendingDepositIndex
    ) external view;

    /// @notice Verifies the first pending deposit's slot or proves that the queue is empty.
    /// @param beaconBlockRoot Root of the beacon block containing the pending-deposits list.
    /// @param slot Expected slot of the first pending deposit; ignored for an empty-queue proof.
    /// @param firstPendingDepositSlotProof Concatenated sibling hashes proving the slot or empty queue.
    /// @return isEmptyDepositQueue True if the proof establishes an empty queue; otherwise false.
    function verifyFirstPendingDeposit(
        bytes32 beaconBlockRoot,
        uint64 slot,
        bytes calldata firstPendingDepositSlotProof
    ) external view returns (bool isEmptyDepositQueue);

    /// @notice Computes the SSZ root of a pending deposit.
    /// @param pubKeyHash SSZ root of the validator's 48-byte public key.
    /// @param withdrawalCredentials Withdrawal credentials whose first 32 bytes form the SSZ field.
    /// @param amountGwei Deposit amount in Gwei.
    /// @param signature The 96-byte BLS deposit signature.
    /// @param slot Beacon slot of the pending deposit.
    /// @return root SSZ root of the pending-deposit container.
    function merkleizePendingDeposit(
        bytes32 pubKeyHash,
        bytes calldata withdrawalCredentials,
        uint64 amountGwei,
        bytes calldata signature,
        uint64 slot
    ) external pure returns (bytes32 root);

    /// @notice Computes the SSZ root of a BLS deposit signature.
    /// @param signature The 96-byte BLS deposit signature.
    /// @return root SSZ root of the signature.
    function merkleizeSignature(bytes calldata signature)
        external
        pure
        returns (bytes32 root);
}

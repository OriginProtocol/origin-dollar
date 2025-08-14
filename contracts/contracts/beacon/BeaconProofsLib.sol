// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Merkle } from "./Merkle.sol";
import { Endian } from "./Endian.sol";

struct FirstPendingDeposit {
    bytes32 root;
    uint64 slot;
    bytes32 pubKeyHash;
    bytes containerProof;
    bytes slotProof;
    bytes pubKeyProof;
}

struct FirstPendingDepositValidator {
    uint64 index;
    bytes32 root;
    bytes containerProof;
    bytes pubKeyProof;
    bytes exitProof;
}

/**
 * @title Library to verify merkle proofs of beacon chain data.
 * @author Origin Protocol Inc
 */
library BeaconProofsLib {
    /// @dev BeaconBlock.state.validators
    /// Beacon block container: height 3, state at index 3
    /// Beacon state container: height 6, validators at index 11
    /// (2 ^ 3 + 3) * 2 ^ 6 + 11 = 715
    uint256 internal constant VALIDATORS_CONTAINER_GENERALIZED_INDEX = 715;

    /// @dev Merkle height of the Balances container
    /// BeaconBlock.state.balances
    uint256 internal constant BALANCES_HEIGHT = 39;
    /// @dev Merkle height of the Validators container
    /// BeaconBlock.state.validators
    uint256 internal constant VALIDATORS_HEIGHT = 41;
    /// @dev Merkle height of the Validator container
    /// BeaconBlock.state.validators[validatorIndex]
    uint256 internal constant VALIDATOR_HEIGHT = 3;

    /// @dev Position of the pubkey field in the Validator container.
    /// BeaconBlock.state.validators[validatorIndex].pubkey
    uint256 internal constant VALIDATOR_PUBKEY_INDEX = 0;

    /// @dev Proof length of the validator public key to the beacon block root.
    /// BeaconBlock.state.validators[validatorIndex].pubkey
    /// Container heights: beacon block 3, state 6, validators 41, validator 3
    /// (3 + 6 + 41 + 3) * 32 bytes = 1696 bytes
    uint256 internal constant VALIDATOR_PUBKEY_PROOF_LEN = 1696;

    /// @dev Index of the beacon state root in the beacon block container.
    /// BeaconBlock container: height 3, state at index 3
    /// 2 ^ 3 + 3 = 11
    uint256 internal constant BEACON_BLOCK__STATE_INDEX = 11;
    /// @dev Proof length of the beacon state root to the beacon block root.
    /// BeaconBlock container height 3
    /// 3 * 32 bytes = 96 bytes
    uint256 internal constant STATE_PROOF_LEN = 96;

    /// @dev Index of the balances container in the beacon state container.
    /// State.balances
    /// Beacon state container: height 6, balances at index 12
    /// 2 ^ 6 + 12 = 76
    uint256 internal constant STATE__BALANCES_INDEX = 76;

    /// @dev Index of the first pending deposit in the state container.
    /// State.PendingDeposits[0]
    /// Beacon state container: height 6, pending deposits at index 34
    /// Pending deposits container: height 28, first deposit at index 0
    /// (2 ^ 6 + 34) * 2 ^ 28 + 0 = 26306674688
    uint256 internal constant STATE__FIRST_PENDING_DEPOSIT_INDEX = 26306674688;
    /// @dev Proof length from the root of first pending deposit to the state root.
    /// Beacon state container height 6
    /// Pending deposits container height 28
    /// (6 + 28) * 32 bytes = 1088 bytes
    uint256 internal constant FIRST_PENDING_DEPOSIT_PROOF_LEN = 1088;

    /// @dev Index of the slot in pending deposit container.
    /// PendingDeposits container: height 3, slot at index 5
    /// 2 ^ 3 + 5 = 13
    uint256 internal constant PENDING_DEPOSIT__SLOT_INDEX = 13;
    /// @dev Index of the public key in pending deposit container.
    /// PendingDeposits container: height 3, public key at index 0
    /// 2 ^ 3 + 0 = 8
    uint256 internal constant PENDING_DEPOSIT__PUBKEY_INDEX = 8;
    /// @dev Proof length of the slot to the root of the pending deposit container.
    /// PendingDeposits container height 3
    /// 3 * 32 bytes = 96 bytes
    uint256 internal constant PENDING_DEPOSIT_PROOF_LEN = 96;

    /// @dev Index of the validator in the state container.
    /// State.validators[0]
    /// Beacon state container: height 6, pending deposits at index 11
    /// 2 ^ 6 + 11 = 75
    uint256 internal constant STATE__VALIDATORS_INDEX = 75;
    /// @dev Proof length of the validators container to the state root.
    /// Beacon state height 6
    /// 6 * 32 bytes = 192 bytes
    uint256 internal constant VALIDATORS_PROOF_LEN = 192;

    /// @dev Index of the validator public key in the validator container.
    /// Validator container: height 3, public key at index 0
    /// 2 ^ 3 + 0 = 8
    uint256 internal constant VALIDATOR__PUBKEY_INDEX = 8;
    /// @dev Index of the validator exit epoch in the validator container.
    /// Validator container: height 3, exit epoch at index 6
    /// 2 ^ 3 + 6 = 11
    uint256 internal constant VALIDATOR__EXIT_INDEX = 11;
    /// @dev Proof length of the validator public key to the validator container root.
    /// 3 * 32 bytes = 96 bytes
    uint256 internal constant VALIDATOR_PROOF_LEN = 96;
    /// @dev Proof length of the balances container to the state root.
    /// Beacon state container height 6
    /// 6 * 32 bytes = 192 bytes
    uint256 internal constant BALANCES_PROOF_LEN = 192;
    /// @dev Proof length of the validator balance to balances container root.
    /// Balances container height 39
    /// 39 * 32 bytes = 1248 bytes
    uint256 internal constant BALANCE_PROOF_LEN = 1248;

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
    ) internal view {
        require(beaconBlockRoot != bytes32(0), "Invalid block root");

        // BeaconBlock.state.validators[validatorIndex]
        uint256 generalizedIndex = concatGenIndices(
            VALIDATORS_CONTAINER_GENERALIZED_INDEX,
            VALIDATORS_HEIGHT,
            validatorIndex
        );
        // BeaconBlock.state.validators[validatorIndex].pubkey
        generalizedIndex = concatGenIndices(
            generalizedIndex,
            VALIDATOR_HEIGHT,
            VALIDATOR_PUBKEY_INDEX
        );

        // Get the withdrawal address from the first witness in the pubkey merkle proof.
        address withdrawalAddressFromProof;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            // The first 32 bytes of the proof is the withdrawal credential so load it into memory.
            calldatacopy(0, proof.offset, 32)
            // Cast the 32 bytes in memory to an address which is the last 20 bytes.
            withdrawalAddressFromProof := mload(0)
        }
        require(
            withdrawalAddressFromProof == withdrawalAddress,
            "Invalid withdrawal address"
        );

        require(
            proof.length == VALIDATOR_PUBKEY_PROOF_LEN &&
                Merkle.verifyInclusionSha256({
                    proof: proof,
                    root: beaconBlockRoot,
                    leaf: pubKeyHash,
                    index: generalizedIndex
                }),
            "Invalid validator pubkey proof"
        );
    }

    function verifyState(
        bytes32 beaconBlockRoot,
        bytes32 stateRoot,
        bytes calldata stateProof
    ) internal view {
        require(beaconBlockRoot != bytes32(0), "Invalid block root");

        // Verify the state container root to the beacon block root
        require(
            stateProof.length == STATE_PROOF_LEN &&
                Merkle.verifyInclusionSha256({
                    proof: stateProof,
                    root: beaconBlockRoot,
                    leaf: stateRoot,
                    index: BEACON_BLOCK__STATE_INDEX
                }),
            "Invalid state proof"
        );
    }

    /// @notice If the deposit queue is not empty,
    /// verify the slot of the first pending deposit to the beacon block root
    /// BeaconBlock.state.PendingDeposits[0].slot
    /// If the deposit queue is empty, verify the root of the first pending deposit is empty
    /// BeaconBlock.state.PendingDeposits[0]
    /// Also verify the validator that the deposit is for is not exiting.
    /// @param stateRoot The root of the beacon state.
    /// @param firstPendingDeposit `FirstPendingDeposit` struct containing:
    ///   `firstPendingDepositSlot` The beacon chain slot of the first deposit in the beacon chain's deposit queue.
    ///          Can be anything if the deposit queue is empty, but zero would be a good choice.
    ///   `firstPendingDepositSlotProof` The merkle proof to the beacon block root. Can be either:
    ///      - 40 witness hashes for BeaconBlock.state.PendingDeposits[0].slot when the deposit queue is not empty.
    ///      - 37 witness hashes for BeaconBlock.state.PendingDeposits[0] when the deposit queue is empty.
    ///      The 32 byte witness hashes are concatenated together starting from the leaf node.
    /// @return isEmptyDepositQueue True if the deposit queue is empty, false otherwise.
    function verifyFirstPendingDeposit(
        bytes32 stateRoot,
        FirstPendingDeposit calldata firstPendingDeposit,
        FirstPendingDepositValidator calldata firstPendingDepositValidator
    ) internal view returns (bool isEmptyDepositQueue) {
        require(stateRoot != bytes32(0), "Invalid state root");

        // Verify the first pending deposit container root to the state root
        require(
            firstPendingDeposit.containerProof.length ==
                FIRST_PENDING_DEPOSIT_PROOF_LEN &&
                Merkle.verifyInclusionSha256({
                    proof: firstPendingDeposit.containerProof,
                    root: stateRoot,
                    leaf: firstPendingDeposit.root,
                    index: STATE__FIRST_PENDING_DEPOSIT_INDEX
                }),
            "Invalid first deposit proof"
        );

        // If the pending deposit queue is empty
        if (firstPendingDeposit.root == bytes32(0)) {
            // The deposit queue is empty so we can use an empty leaf node
            return true;
        }

        // Verify the slot in the first pending deposit
        require(
            firstPendingDeposit.slotProof.length == PENDING_DEPOSIT_PROOF_LEN &&
                Merkle.verifyInclusionSha256({
                    proof: firstPendingDeposit.slotProof,
                    root: firstPendingDeposit.root,
                    leaf: Endian.toLittleEndianUint64(firstPendingDeposit.slot),
                    index: PENDING_DEPOSIT__SLOT_INDEX
                }),
            "Invalid deposit slot proof"
        );

        // Verify the public key of the first pending deposit
        require(
            firstPendingDeposit.pubKeyProof.length ==
                PENDING_DEPOSIT_PROOF_LEN &&
                Merkle.verifyInclusionSha256({
                    proof: firstPendingDeposit.pubKeyProof,
                    root: firstPendingDeposit.root,
                    leaf: firstPendingDeposit.pubKeyHash,
                    index: PENDING_DEPOSIT__PUBKEY_INDEX
                }),
            "Invalid deposit pub key proof"
        );

        if (firstPendingDepositValidator.root == bytes32(0)) {
            // The deposit is to a new validator so no need to verify if it is exiting.
            return true;
        }

        // Verify the validator container root to the state root
        // State.validators[validatorIndex]
        uint256 validatorIndexInState = concatGenIndices(
            STATE__VALIDATORS_INDEX,
            VALIDATORS_HEIGHT,
            firstPendingDepositValidator.index
        );
        require(
            firstPendingDepositValidator.containerProof.length ==
                VALIDATORS_PROOF_LEN &&
                Merkle.verifyInclusionSha256({
                    proof: firstPendingDepositValidator.containerProof,
                    root: stateRoot,
                    leaf: firstPendingDepositValidator.root,
                    index: validatorIndexInState
                }),
            "Invalid validators proof"
        );

        // Verify the validator public key to the validators container root
        // This verifies the validator index is correct for the first pending deposit
        require(
            firstPendingDepositValidator.pubKeyProof.length ==
                VALIDATOR_PROOF_LEN &&
                Merkle.verifyInclusionSha256({
                    proof: firstPendingDepositValidator.pubKeyProof,
                    root: firstPendingDepositValidator.root,
                    leaf: firstPendingDeposit.pubKeyHash,
                    index: VALIDATOR__PUBKEY_INDEX
                }),
            "Invalid validator pubkey proof"
        );

        // Verify the validator exit epoch to the validator container root
        // A max epoch means the validator is not exiting.
        require(
            firstPendingDepositValidator.exitProof.length ==
                VALIDATOR_PROOF_LEN &&
                Merkle.verifyInclusionSha256({
                    proof: firstPendingDepositValidator.exitProof,
                    root: firstPendingDepositValidator.root,
                    leaf: Endian.toLittleEndianUint64(type(uint64).max),
                    index: VALIDATOR__EXIT_INDEX
                }),
            "Invalid validator exit proof"
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
    ) internal view {
        require(stateRoot != bytes32(0), "Invalid state root");

        // State.balances
        require(
            proof.length == BALANCES_PROOF_LEN &&
                Merkle.verifyInclusionSha256({
                    proof: proof,
                    root: stateRoot,
                    leaf: balancesContainerRoot,
                    index: STATE__BALANCES_INDEX
                }),
            "Invalid balance container proof"
        );
    }

    /// @notice Verifies the validator balance to the root of the Balances container.
    /// @param balancesContainerRoot The merkle root of the Balances container.
    /// @param validatorBalanceLeaf The leaf node containing the validator balance with three other balances.
    /// @param balanceProof The merkle proof for the validator balance to the Balances container root.
    /// This is 39 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    /// @param validatorIndex The validator index to verify the balance for.
    /// @return validatorBalanceGwei The balance in Gwei of the validator at the given index.
    function verifyValidatorBalance(
        bytes32 balancesContainerRoot,
        bytes32 validatorBalanceLeaf,
        bytes calldata balanceProof,
        uint64 validatorIndex
    ) internal view returns (uint256 validatorBalanceGwei) {
        require(balancesContainerRoot != bytes32(0), "Invalid container root");

        // Four balances are stored in each leaf so the validator index is divided by 4
        uint64 balanceIndex = validatorIndex / 4;

        // Get the index within the balances container, not the Beacon Block or State
        // BeaconBlock.state.balances[balanceIndex]
        uint256 generalizedIndex = concatGenIndices(
            1,
            BALANCES_HEIGHT,
            balanceIndex
        );

        require(
            balanceProof.length == BALANCE_PROOF_LEN &&
                Merkle.verifyInclusionSha256({
                    proof: balanceProof,
                    root: balancesContainerRoot,
                    leaf: validatorBalanceLeaf,
                    index: generalizedIndex
                }),
            "Invalid balance proof"
        );

        // Parse the balance from the leaf node which has four balances.
        validatorBalanceGwei = balanceAtIndex(
            validatorBalanceLeaf,
            validatorIndex
        );
    }

    ////////////////////////////////////////////////////
    ///       Internal Helper Functions
    ////////////////////////////////////////////////////

    function balanceAtIndex(bytes32 validatorBalanceLeaf, uint64 validatorIndex)
        internal
        pure
        returns (uint256)
    {
        uint256 bitShiftAmount = (validatorIndex % 4) * 64;
        return
            Endian.fromLittleEndianUint64(
                bytes32((uint256(validatorBalanceLeaf) << bitShiftAmount))
            );
    }

    /// @notice Concatenates two beacon chain generalized indices into one.
    /// @param genIndex The first generalized index or 1 if calculating for a single container.
    /// @param height The merkle tree height of the second container. eg 39 for balances, 41 for validators.
    /// @param index The index within the second container. eg the validator index.
    /// @return genIndex The concatenated generalized index.
    function concatGenIndices(
        uint256 genIndex,
        uint256 height,
        uint256 index
    ) internal pure returns (uint256) {
        return (genIndex << height) | index;
    }
}

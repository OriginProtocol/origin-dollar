// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Merkle } from "./Merkle.sol";
import { Endian } from "./Endian.sol";

/**
 * @title Library to verify merkle proofs of beacon chain data.
 * @author Origin Protocol Inc
 */
library BeaconProofsLib {
    // Known generalized indices in the beacon block
    /// @dev BeaconBlock.state.PendingDeposits[0]
    /// Beacon block container: height 3, state at at index 3
    /// Beacon state container: height 6, pending deposits at index 34
    /// Pending deposits container: height 28, first deposit at index 0
    /// ((2 ^ 3 + 3) * 2 ^ 6 + 34) * 2 ^ 28 + 0 = 198105366528
    uint256 internal constant FIRST_PENDING_DEPOSIT_GENERALIZED_INDEX =
        198105366528;
    /// @dev BeaconBlock.state.PendingDeposits[0].pubkey
    /// Pending Deposit container: height 3, pubkey at index 0
    /// (((2 ^ 3 + 3) * 2 ^ 6 + 34) * 2 ^ 28 + 0) * 2 ^ 3 + 0  = 1584842932224
    uint256 internal constant FIRST_PENDING_DEPOSIT_PUBKEY_GENERALIZED_INDEX =
        1584842932224;
    /// @dev BeaconBlock.state.PendingDeposits[0].pubkey
    /// Pending Deposit container: height 3, pubkey at index 4
    /// (((2 ^ 3 + 3) * 2 ^ 6 + 34) * 2 ^ 28 + 0) * 2 ^ 3 + 4  = 1584842932228
    uint256 internal constant FIRST_PENDING_DEPOSIT_SLOT_GENERALIZED_INDEX =
        1584842932228;
    /// @dev BeaconBlock.state.validators
    /// Beacon block container: height 3, state at at index 3
    /// Beacon state container: height 6, validators at index 11
    /// (2 ^ 3 + 3) * 2 ^ 6 + 11 = 715
    uint256 internal constant VALIDATORS_CONTAINER_GENERALIZED_INDEX = 715;
    /// @dev BeaconBlock.state.balances
    /// Beacon block container: height 3, state at at index 3
    /// Beacon state container: height 6, balances at index 13
    /// (2 ^ 3 + 3) * 2 ^ 6 + 13 = 716
    uint256 internal constant BALANCES_CONTAINER_GENERALIZED_INDEX = 716;

    /// @dev Number of bytes in the proof to the first pending deposit.
    /// 37 witness hashes of 32 bytes each concatenated together.
    /// BeaconBlock.state.PendingDeposits[0]
    /// 37 * 32 bytes = 1184 bytes
    uint256 internal constant FIRST_PENDING_DEPOSIT_PROOF_LENGTH = 1184;
    /// @dev Number of bytes in the proof from the pubKey of the first pending deposit to the beacon block root.
    /// 40 witness hashes of 32 bytes each concatenated together.
    /// BeaconBlock.state.PendingDeposits[0].pubKey
    /// 40 * 32 bytes = 1280 bytes
    uint256 internal constant FIRST_PENDING_DEPOSIT_PUBKEY_PROOF_LENGTH = 1280;
    /// @dev Number of bytes in the proof from the slot of the first pending deposit to the beacon block root.
    /// 40 witness hashes of 32 bytes each concatenated together.
    /// BeaconBlock.state.PendingDeposits[0].slot
    /// 40 * 32 bytes = 1280 bytes
    uint256 internal constant FIRST_PENDING_DEPOSIT_SLOT_PROOF_LENGTH = 1280;
    /// The slot is at index 4 in the Pending Deposits container.
    /// The sub tree from the right node from the root is a tree of height 2.
    /// The first 32 bytes witness is an empty bytes32 as there are
    /// no items after the slot in the Pending Deposits container.
    /// The second 32 bytes witness is a hash or two empty bytes32.
    bytes internal constant PENDING_DEPOSIT_SLOT_PROOF =
        // solhint-disable-next-line max-line-length
        hex"0000000000000000000000000000000000000000000000000000000000000000f5a5fd42d16a20302798ef6ed309979b43003d2320d9f0e8ea9831a92759fb4b";

    /// @dev Merkle height of the Balances container
    /// BeaconBlock.state.balances
    uint256 internal constant BALANCES_HEIGHT = 39;
    /// @dev Merkle height of the Validators container list
    /// BeaconBlock.state.validators
    uint256 internal constant VALIDATORS_LIST_HEIGHT = 41;
    /// @dev Merkle height of the Validator container
    /// BeaconBlock.state.validators[validatorIndex]
    uint256 internal constant VALIDATOR_CONTAINER_HEIGHT = 3;

    /// @dev Position of the pubkey field in the Validator container.
    /// BeaconBlock.state.validators[validatorIndex].pubkey
    uint256 internal constant VALIDATOR_PUBKEY_INDEX = 0;
    /// @dev Position of the withdrawable epoch field in the Validator container.
    /// BeaconBlock.state.validators[validatorIndex].withdrawableEpoch
    uint256 internal constant VALIDATOR_WITHDRAWABLE_EPOCH_INDEX = 7;

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
    ) internal view {
        require(beaconBlockRoot != bytes32(0), "Invalid block root");

        // BeaconBlock.state.validators[validatorIndex]
        uint256 generalizedIndex = concatGenIndices(
            VALIDATORS_CONTAINER_GENERALIZED_INDEX,
            VALIDATORS_LIST_HEIGHT,
            validatorIndex
        );
        // BeaconBlock.state.validators[validatorIndex].pubkey
        generalizedIndex = concatGenIndices(
            generalizedIndex,
            VALIDATOR_CONTAINER_HEIGHT,
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
            // 53 * 32 bytes = 1696 bytes
            proof.length == 1696 &&
                Merkle.verifyInclusionSha256({
                    proof: proof,
                    root: beaconBlockRoot,
                    leaf: pubKeyHash,
                    index: generalizedIndex
                }),
            "Invalid validator proof"
        );
    }

    /// @notice Verifies a validator's withdrawable epoch to the beacon block root
    /// for a given validator index.
    /// BeaconBlock.state.validators[validatorIndex].withdrawableEpoch
    /// @param beaconBlockRoot The root of the beacon block
    /// @param validatorIndex The validator index to verify the withdrawable epoch for.
    /// @param withdrawableEpoch The withdrawable epoch to verify in big endian uint64 format
    /// @param proof The merkle proof for the validator's withdrawable epoch to the beacon block root.
    /// This is 53 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    function verifyValidatorWithdrawableEpoch(
        bytes32 beaconBlockRoot,
        uint40 validatorIndex,
        uint64 withdrawableEpoch,
        bytes calldata proof
    ) internal view {
        require(beaconBlockRoot != bytes32(0), "Invalid block root");

        // BeaconBlock.state.validators[validatorIndex]
        uint256 exitEpochGenIndex = concatGenIndices(
            VALIDATORS_CONTAINER_GENERALIZED_INDEX,
            VALIDATORS_LIST_HEIGHT,
            validatorIndex
        );
        // BeaconBlock.state.validators[validatorIndex].withdrawableEpoch
        exitEpochGenIndex = concatGenIndices(
            exitEpochGenIndex,
            VALIDATOR_CONTAINER_HEIGHT,
            VALIDATOR_WITHDRAWABLE_EPOCH_INDEX
        );

        require(
            // 53 * 32 bytes = 1696 bytes
            proof.length == 1696 &&
                Merkle.verifyInclusionSha256({
                    proof: proof,
                    root: beaconBlockRoot,
                    leaf: Endian.toLittleEndianUint64(withdrawableEpoch),
                    index: exitEpochGenIndex
                }),
            "Invalid withdrawable proof"
        );
    }

    /// @param subTreeRoot The third 32 byte witness from the withdrawable epoch proof
    /// @param pubKeyHash Hash of validator's public key using the Beacon Chain's format
    /// @param proof The merkle proof for the validator public key in a sub tree of height two.
    /// This is 2 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    function verifyValidatorPubKeySubTree(
        bytes32 subTreeRoot,
        bytes32 pubKeyHash,
        bytes calldata proof
    ) internal view {
        // Tree height 2 and pub key is at index 0
        // index = 2 ^ 2 + 0 = 4
        require(
            // 2 * 32 bytes = 64 bytes
            proof.length == 64 &&
                Merkle.verifyInclusionSha256({
                    proof: proof,
                    root: subTreeRoot,
                    leaf: pubKeyHash,
                    index: 4
                }),
            "Invalid pub key proof"
        );
    }

    /// @notice Verifies the balances container to the beacon block root.
    /// BeaconBlock.state.balances
    /// @param beaconBlockRoot The root of the beacon block.
    /// @param balancesContainerRoot The merkle root of the the balances container.
    /// @param proof The merkle proof for the balances container to the beacon block root.
    /// This is 9 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    function verifyBalancesContainer(
        bytes32 beaconBlockRoot,
        bytes32 balancesContainerRoot,
        bytes calldata proof
    ) internal view {
        require(beaconBlockRoot != bytes32(0), "Invalid block root");

        // BeaconBlock.state.balances
        require(
            // 9 * 32 bytes = 288 bytes
            proof.length == 288 &&
                Merkle.verifyInclusionSha256({
                    proof: proof,
                    root: beaconBlockRoot,
                    leaf: balancesContainerRoot,
                    index: BALANCES_CONTAINER_GENERALIZED_INDEX
                }),
            "Invalid balance container proof"
        );
    }

    /// @notice Verifies the validator balance to the root of the Balances container.
    /// @param balancesContainerRoot The merkle root of the Balances container.
    /// @param validatorBalanceLeaf The leaf node containing the validator balance with three other balances.
    /// @param proof The merkle proof for the validator balance to the Balances container root.
    /// This is 39 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    /// @param validatorIndex The validator index to verify the balance for.
    /// @return validatorBalanceGwei The balance in Gwei of the validator at the given index.
    function verifyValidatorBalance(
        bytes32 balancesContainerRoot,
        bytes32 validatorBalanceLeaf,
        bytes calldata proof,
        uint40 validatorIndex
    ) internal view returns (uint256 validatorBalanceGwei) {
        require(balancesContainerRoot != bytes32(0), "Invalid container root");

        // Four balances are stored in each leaf so the validator index is divided by 4
        uint64 balanceIndex = validatorIndex / 4;

        // Get the index within the balances container, not the Beacon Block
        // BeaconBlock.state.balances[balanceIndex]
        uint256 generalizedIndex = concatGenIndices(
            1,
            BALANCES_HEIGHT,
            balanceIndex
        );

        validatorBalanceGwei = balanceAtIndex(
            validatorBalanceLeaf,
            validatorIndex
        );

        require(
            // 39 * 32 bytes = 1248 bytes
            proof.length == 1248 &&
                Merkle.verifyInclusionSha256({
                    proof: proof,
                    root: balancesContainerRoot,
                    leaf: validatorBalanceLeaf,
                    index: generalizedIndex
                }),
            "Invalid balance proof"
        );
    }

    /// @notice If the deposit queue is not empty,
    /// verify the pubKey and slot of the first pending deposit to the beacon block root.
    /// BeaconBlock.state.pendingDeposits[0].pubKey
    /// BeaconBlock.state.pendingDeposits[0].slot
    /// If the deposit queue is empty, verify the root of the first pending deposit is empty
    /// BeaconBlock.state.PendingDeposits[0]
    /// @param beaconBlockRoot The root of the beacon block.
    /// @param slot The beacon chain slot of the first deposit in the beacon chain's deposit queue.
    /// Can be anything if the deposit queue is empty, but zero would be a good choice.
    /// @param pubKeyHash The hash of the validator public key for the first pending deposit.
    /// Use zero bytes if the deposit queue is empty.
    /// @param proof The merkle proof to the beacon block root. Can be either:
    /// - 40 witness hashes for BeaconBlock.state.PendingDeposits[0].pubKey when the deposit queue is not empty.
    /// - 37 witness hashes for BeaconBlock.state.PendingDeposits[0] when the deposit queue is empty.
    /// The 32 byte witness hashes are concatenated together starting from the leaf node.
    /// @return isEmptyDepositQueue True if the deposit queue is empty, false otherwise.
    function verifyFirstPendingDeposit(
        bytes32 beaconBlockRoot,
        uint64 slot,
        bytes32 pubKeyHash,
        bytes calldata proof
    ) internal view returns (bool isEmptyDepositQueue) {
        require(beaconBlockRoot != bytes32(0), "Invalid block root");

        // If the deposit queue is empty
        if (proof.length == FIRST_PENDING_DEPOSIT_PROOF_LENGTH) {
            require(
                Merkle.verifyInclusionSha256({
                    proof: proof,
                    root: beaconBlockRoot,
                    leaf: bytes32(0),
                    index: FIRST_PENDING_DEPOSIT_GENERALIZED_INDEX
                }),
                "Invalid empty deposits proof"
            );
            return true;
        }

        // Verify the public key of the first pending deposit
        // BeaconBlock.state.PendingDeposits[0].pubKey
        require(
            proof.length == FIRST_PENDING_DEPOSIT_PUBKEY_PROOF_LENGTH &&
                Merkle.verifyInclusionSha256({
                    proof: proof,
                    root: beaconBlockRoot,
                    leaf: pubKeyHash,
                    index: FIRST_PENDING_DEPOSIT_PUBKEY_GENERALIZED_INDEX
                }),
            "Invalid deposit pub key proof"
        );

        // Now verify the slot of the first pending deposit

        // Get the third 32 bytes witness from the first pending deposit pubKey proof
        // 2 * 32 bytes = 64 bytes offset
        bytes32 slotRoot = bytes32(proof[64:96]);

        // Sub tree height 2 and slot is at index 0 in the sub tree
        // index = 2 ^ 2 + 0 = 4
        require(
            Merkle.verifyInclusionSha256({
                proof: PENDING_DEPOSIT_SLOT_PROOF,
                root: slotRoot,
                leaf: Endian.toLittleEndianUint64(slot),
                index: 4
            }),
            "Invalid deposit slot"
        );
    }

    /// @notice If the deposit queue is not empty,
    /// verify the slot of the first pending deposit to the beacon block root.
    /// BeaconBlock.state.pendingDeposits[0].slot
    /// If the deposit queue is empty, verify the root of the first pending deposit is empty
    /// BeaconBlock.state.PendingDeposits[0]
    /// @param beaconBlockRoot The root of the beacon block.
    /// @param slot The beacon chain slot of the first deposit in the beacon chain's deposit queue.
    /// Can be anything if the deposit queue is empty, but zero would be a good choice.
    /// @param proof The merkle proof to the beacon block root. Can be either:
    /// - 40 witness hashes for BeaconBlock.state.PendingDeposits[0].slot when the deposit queue is not empty.
    /// - 37 witness hashes for BeaconBlock.state.PendingDeposits[0] when the deposit queue is empty.
    /// The 32 byte witness hashes are concatenated together starting from the leaf node.
    /// @return isEmptyDepositQueue True if the deposit queue is empty, false otherwise.
    function verifyFirstPendingDeposit(
        bytes32 beaconBlockRoot,
        uint64 slot,
        bytes calldata proof
    ) internal view returns (bool isEmptyDepositQueue) {
        require(beaconBlockRoot != bytes32(0), "Invalid block root");

        // If the deposit queue is empty
        if (proof.length == FIRST_PENDING_DEPOSIT_PROOF_LENGTH) {
            require(
                Merkle.verifyInclusionSha256({
                    proof: proof,
                    root: beaconBlockRoot,
                    leaf: bytes32(0),
                    index: FIRST_PENDING_DEPOSIT_GENERALIZED_INDEX
                }),
                "Invalid empty deposits proof"
            );
            return true;
        }

        // Verify the public key of the first pending deposit
        // BeaconBlock.state.PendingDeposits[0].slot
        require(
            proof.length == FIRST_PENDING_DEPOSIT_SLOT_PROOF_LENGTH &&
                Merkle.verifyInclusionSha256({
                    proof: proof,
                    root: beaconBlockRoot,
                    leaf: Endian.toLittleEndianUint64(slot),
                    index: FIRST_PENDING_DEPOSIT_SLOT_GENERALIZED_INDEX
                }),
            "Invalid deposit slot proof"
        );
    }

    ////////////////////////////////////////////////////
    ///       Internal Helper Functions
    ////////////////////////////////////////////////////

    function balanceAtIndex(bytes32 validatorBalanceLeaf, uint40 validatorIndex)
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

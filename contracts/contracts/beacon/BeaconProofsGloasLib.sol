// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconProofsLib } from "./BeaconProofsLib.sol";
import { Merkle } from "./Merkle.sol";
import { Endian } from "./Endian.sol";

/**
 * @title Library to verify Glamsterdam/Gloas merkle proofs of beacon chain data.
 * @author Origin Protocol Inc
 * @dev Uses progressive SSZ containers and lists. Proofs contain SHA-256 sibling hashes
 * ordered from the proven node towards the root. Callers must authenticate supplied roots
 * and ensure they use the Gloas layout; inclusion alone does not identify a root's fork.
 */
library BeaconProofsGloasLib {
    /// @dev BeaconBlock.state_root, relative to the BeaconBlock root.
    uint256 internal constant BEACON_BLOCK_STATE_ROOT_GENERALIZED_INDEX = 11;
    /// @dev Progressive BeaconState.validators, relative to the state root.
    uint256 internal constant BEACON_STATE_VALIDATORS_GENERALIZED_INDEX = 358;
    /// @dev Progressive BeaconState.balances, relative to the state root.
    uint256 internal constant BEACON_STATE_BALANCES_GENERALIZED_INDEX = 359;
    /// @dev Progressive BeaconState.pending_deposits, relative to the state root.
    uint256 internal constant BEACON_STATE_PENDING_DEPOSITS_GENERALIZED_INDEX =
        2957;
    /// @dev Left child of a progressive list root; the right child holds its length.
    uint256 internal constant PROGRESSIVE_LIST_CHUNKS_GENERALIZED_INDEX = 2;
    /// @dev Successive progressive subtrees contain 1, 4, 16, ... chunks.
    uint256 internal constant PROGRESSIVE_LIST_BASE_CHUNK_COUNT = 1;
    uint256 internal constant PROGRESSIVE_LIST_SCALING_FACTOR = 4;
    /// @dev Each 32-byte balance chunk packs four little-endian uint64 Gwei amounts.
    uint256 internal constant BALANCES_PER_LEAF = 4;
    /// @dev Validator is a fixed container with eight field roots.
    uint256 internal constant VALIDATOR_CONTAINER_HEIGHT = 3;
    uint256 internal constant VALIDATOR_PUBKEY_INDEX = 0;
    uint256 internal constant VALIDATOR_WITHDRAWABLE_EPOCH_INDEX = 7;
    /// @dev PendingDeposit is a fixed container padded to eight field roots.
    uint256 internal constant PENDING_DEPOSIT_CONTAINER_HEIGHT = 3;
    uint256 internal constant PENDING_DEPOSIT_SLOT_INDEX = 4;

    /// @notice Verifies a validator's public-key hash and withdrawal credentials against a beacon block root.
    /// @dev Proves BeaconBlock.state.validators[validatorIndex].pubkey. The first sibling
    /// is the withdrawal-credentials field. Proof depth depends on the progressive list index.
    /// @param beaconBlockRoot The nonzero Gloas beacon block root.
    /// @param pubKeyHash The SSZ hash-tree-root of the validator's 48-byte public key.
    /// @param proof Concatenated 32-byte sibling hashes, starting at the public-key field.
    /// @param validatorIndex The validator's index in the validators list.
    /// @param withdrawalCredentials The expected 32-byte withdrawal credentials.
    function verifyValidator(
        bytes32 beaconBlockRoot,
        bytes32 pubKeyHash,
        bytes calldata proof,
        uint40 validatorIndex,
        bytes32 withdrawalCredentials
    ) internal view {
        require(beaconBlockRoot != bytes32(0), "Invalid block root");

        uint256 generalizedIndex = validatorFieldGindex(
            validatorIndex,
            VALIDATOR_PUBKEY_INDEX
        );
        require(
            hasValidProofLength(proof, generalizedIndex),
            "Invalid validator proof"
        );

        bytes32 withdrawalCredentialsFromProof = bytes32(proof[:32]);
        require(
            withdrawalCredentialsFromProof == withdrawalCredentials,
            "Invalid withdrawal cred"
        );

        require(
            Merkle.verifyInclusionSha256({
                proof: proof,
                root: beaconBlockRoot,
                leaf: pubKeyHash,
                index: generalizedIndex
            }),
            "Invalid validator proof"
        );
    }

    /// @notice Verifies a validator's withdrawable epoch against a beacon block root.
    /// @dev Encodes the epoch as a little-endian uint64 SSZ field root. Proof depth depends
    /// on the validator's progressive list index, with three additional Validator field levels.
    /// @param beaconBlockRoot The nonzero Gloas beacon block root.
    /// @param validatorIndex The validator's index in the validators list.
    /// @param withdrawableEpoch The epoch as a native Solidity uint64, encoded internally for SSZ.
    /// @param proof Concatenated 32-byte sibling hashes from the epoch field to the block root.
    function verifyValidatorWithdrawableEpoch(
        bytes32 beaconBlockRoot,
        uint40 validatorIndex,
        uint64 withdrawableEpoch,
        bytes calldata proof
    ) internal view {
        require(beaconBlockRoot != bytes32(0), "Invalid block root");

        uint256 generalizedIndex = validatorFieldGindex(
            validatorIndex,
            VALIDATOR_WITHDRAWABLE_EPOCH_INDEX
        );

        require(
            hasValidProofLength(proof, generalizedIndex) &&
                Merkle.verifyInclusionSha256({
                    proof: proof,
                    root: beaconBlockRoot,
                    leaf: Endian.toLittleEndianUint64(withdrawableEpoch),
                    index: generalizedIndex
                }),
            "Invalid withdrawable proof"
        );
    }

    /// @notice Verifies the balances list root against a beacon block root.
    /// @dev BeaconBlock.state.balances has generalized index 2919, requiring 11 witnesses.
    /// @param beaconBlockRoot The nonzero Gloas beacon block root.
    /// @param balancesContainerRoot The balances progressive-list root, including its length mix-in.
    /// @param proof The 352-byte proof: eleven 32-byte siblings ordered towards the block root.
    function verifyBalancesContainer(
        bytes32 beaconBlockRoot,
        bytes32 balancesContainerRoot,
        bytes calldata proof
    ) internal view {
        require(beaconBlockRoot != bytes32(0), "Invalid block root");

        require(
            hasValidProofLength(proof, balancesContainerGindex()) &&
                Merkle.verifyInclusionSha256({
                    proof: proof,
                    root: beaconBlockRoot,
                    leaf: balancesContainerRoot,
                    index: balancesContainerGindex()
                }),
            "Invalid balance container proof"
        );
    }

    /// @notice Verifies a packed balance chunk and returns the selected validator's balance.
    /// @dev The chunk index is validatorIndex / 4; validatorIndex % 4 selects a little-endian
    /// uint64 within the chunk. Proof depth depends on the chunk's progressive index.
    /// The caller must authenticate the Gloas list root; this does not check the list length.
    /// @param balancesContainerRoot The nonzero Gloas balances progressive-list root.
    /// @param validatorBalanceLeaf The 32-byte chunk containing up to four packed balances.
    /// @param proof Concatenated 32-byte sibling hashes from the chunk to the list root.
    /// @param validatorIndex The validator's index in the balances list.
    /// @return validatorBalanceGwei The selected validator's balance in Gwei.
    function verifyValidatorBalance(
        bytes32 balancesContainerRoot,
        bytes32 validatorBalanceLeaf,
        bytes calldata proof,
        uint40 validatorIndex
    ) internal view returns (uint256 validatorBalanceGwei) {
        require(balancesContainerRoot != bytes32(0), "Invalid container root");

        uint64 balanceIndex = validatorIndex / uint64(BALANCES_PER_LEAF);
        uint256 generalizedIndex = progressiveListElementGindex(balanceIndex);

        validatorBalanceGwei = BeaconProofsLib.balanceAtIndex(
            validatorBalanceLeaf,
            validatorIndex
        );

        require(
            hasValidProofLength(proof, generalizedIndex) &&
                Merkle.verifyInclusionSha256({
                    proof: proof,
                    root: balancesContainerRoot,
                    leaf: validatorBalanceLeaf,
                    index: generalizedIndex
                }),
            "Invalid balance proof"
        );
    }

    /// @notice Verifies the pending-deposits list root against a beacon block root.
    /// @dev BeaconBlock.state.pending_deposits has generalized index 23437, requiring 14 witnesses.
    /// @param beaconBlockRoot The nonzero Gloas beacon block root.
    /// @param pendingDepositsContainerRoot The pending-deposits progressive-list root including its length mix-in.
    /// @param proof The 448-byte proof: fourteen 32-byte siblings ordered towards the block root.
    function verifyPendingDepositsContainer(
        bytes32 beaconBlockRoot,
        bytes32 pendingDepositsContainerRoot,
        bytes calldata proof
    ) internal view {
        require(beaconBlockRoot != bytes32(0), "Invalid block root");

        require(
            hasValidProofLength(proof, pendingDepositsContainerGindex()) &&
                Merkle.verifyInclusionSha256({
                    proof: proof,
                    root: beaconBlockRoot,
                    leaf: pendingDepositsContainerRoot,
                    index: pendingDepositsContainerGindex()
                }),
            "Invalid deposit container proof"
        );
    }

    /// @notice Verifies a pending deposit root within a Gloas pending-deposits list.
    /// @dev Proof depth depends on the deposit's progressive list index. The caller must
    /// authenticate the list root; this function does not check the list length or deposit fields.
    /// @param pendingDepositsContainerRoot The nonzero Gloas pending-deposits progressive-list root.
    /// @param pendingDepositRoot The SSZ hash-tree-root of the pending deposit.
    /// @param proof Concatenated 32-byte sibling hashes from the deposit root to the list root.
    /// @param pendingDepositIndex The deposit's index in the pending-deposits list.
    function verifyPendingDeposit(
        bytes32 pendingDepositsContainerRoot,
        bytes32 pendingDepositRoot,
        bytes calldata proof,
        uint32 pendingDepositIndex
    ) internal view {
        require(pendingDepositsContainerRoot != bytes32(0), "Invalid root");

        uint256 generalizedIndex = progressiveListElementGindex(
            pendingDepositIndex
        );

        require(
            hasValidProofLength(proof, generalizedIndex) &&
                Merkle.verifyInclusionSha256({
                    proof: proof,
                    root: pendingDepositsContainerRoot,
                    leaf: pendingDepositRoot,
                    index: generalizedIndex
                }),
            "Invalid deposit proof"
        );
    }

    /// @notice Verifies an empty pending-deposits queue or the first pending deposit's slot.
    /// @dev For an empty queue, proves a zero chunk at the first deposit path (16 witnesses).
    /// Otherwise proves the slot field within the first PendingDeposit (19 witnesses).
    /// Emptiness relies on the canonical Gloas state encoding, rather than a direct length proof.
    /// @param beaconBlockRoot The nonzero Gloas beacon block root.
    /// @param slot The first pending deposit's slot as a native uint64; ignored for an empty queue.
    /// @param proof Concatenated siblings towards the block root: 512 bytes for the empty-queue
    /// proof, or 608 bytes for the slot proof. The slot is encoded as little-endian SSZ internally.
    /// @return isEmptyDepositQueue True for the zero-chunk proof, false for a valid slot proof.
    function verifyFirstPendingDeposit(
        bytes32 beaconBlockRoot,
        uint64 slot,
        bytes calldata proof
    ) internal view returns (bool isEmptyDepositQueue) {
        require(beaconBlockRoot != bytes32(0), "Invalid block root");

        uint256 firstPendingDepositGindex = pendingDepositGindex(0);

        if (
            hasValidProofLength(proof, firstPendingDepositGindex) &&
            Merkle.verifyInclusionSha256({
                proof: proof,
                root: beaconBlockRoot,
                leaf: bytes32(0),
                index: firstPendingDepositGindex
            })
        ) {
            return true;
        }

        uint256 slotGindex = concatGeneralizedIndices(
            firstPendingDepositGindex,
            toGindex(
                PENDING_DEPOSIT_CONTAINER_HEIGHT,
                PENDING_DEPOSIT_SLOT_INDEX
            )
        );

        require(
            hasValidProofLength(proof, slotGindex) &&
                Merkle.verifyInclusionSha256({
                    proof: proof,
                    root: beaconBlockRoot,
                    leaf: Endian.toLittleEndianUint64(slot),
                    index: slotGindex
                }),
            "Invalid deposit slot proof"
        );
    }

    /// @notice Returns the validators list's generalized index relative to the beacon block root.
    /// @return The concatenation of block state-root index 11 and state validators index 358: 2918.
    function validatorsContainerGindex() internal pure returns (uint256) {
        return
            concatGeneralizedIndices(
                BEACON_BLOCK_STATE_ROOT_GENERALIZED_INDEX,
                BEACON_STATE_VALIDATORS_GENERALIZED_INDEX
            );
    }

    /// @notice Returns the balances list's generalized index relative to the beacon block root.
    /// @return The concatenation of block state-root index 11 and state balances index 359: 2919.
    function balancesContainerGindex() internal pure returns (uint256) {
        return
            concatGeneralizedIndices(
                BEACON_BLOCK_STATE_ROOT_GENERALIZED_INDEX,
                BEACON_STATE_BALANCES_GENERALIZED_INDEX
            );
    }

    /// @notice Returns the pending-deposits list's generalized index relative to the beacon block root.
    /// @return The concatenation of block state-root index 11 and state pending-deposits index 2957: 23437.
    function pendingDepositsContainerGindex() internal pure returns (uint256) {
        return
            concatGeneralizedIndices(
                BEACON_BLOCK_STATE_ROOT_GENERALIZED_INDEX,
                BEACON_STATE_PENDING_DEPOSITS_GENERALIZED_INDEX
            );
    }

    /// @notice Returns a Validator field's generalized index relative to the beacon block root.
    /// @dev Appends three field-path bits to the validator element path. Does not validate fieldIndex.
    /// @param validatorIndex The validator's progressive list index.
    /// @param fieldIndex The zero-based field position, which the caller must keep below eight.
    /// @return The block-relative generalized index of the selected field.
    function validatorFieldGindex(uint40 validatorIndex, uint256 fieldIndex)
        internal
        pure
        returns (uint256)
    {
        return
            concatGeneralizedIndices(
                validatorGindex(validatorIndex),
                toGindex(VALIDATOR_CONTAINER_HEIGHT, fieldIndex)
            );
    }

    /// @notice Returns a validator element's generalized index relative to the beacon block root.
    /// @param validatorIndex The validator's progressive list index.
    /// @return The validators-list path concatenated with the element's list-relative path.
    function validatorGindex(uint40 validatorIndex)
        internal
        pure
        returns (uint256)
    {
        return
            concatGeneralizedIndices(
                validatorsContainerGindex(),
                progressiveListElementGindex(validatorIndex)
            );
    }

    /// @notice Returns a pending deposit's generalized index relative to the beacon block root.
    /// @param pendingDepositIndex The deposit's progressive list index.
    /// @return The pending-deposits-list path concatenated with the element's list-relative path.
    function pendingDepositGindex(uint32 pendingDepositIndex)
        internal
        pure
        returns (uint256)
    {
        return
            concatGeneralizedIndices(
                pendingDepositsContainerGindex(),
                progressiveListElementGindex(pendingDepositIndex)
            );
    }

    /// @notice Returns a chunk's generalized index relative to a progressive list root.
    /// @dev Prepends the list's left-child path to the progressive chunk path, accounting
    /// for the length mix-in. Composite elements occupy one chunk root each; packed basic
    /// elements must first be converted to a chunk index. Does not check the list length.
    /// @param elementIndex The chunk index, or element index for a list of composite values.
    /// @return The generalized index relative to the full progressive-list root.
    function progressiveListElementGindex(uint256 elementIndex)
        internal
        pure
        returns (uint256)
    {
        return
            concatGeneralizedIndices(
                PROGRESSIVE_LIST_CHUNKS_GENERALIZED_INDEX,
                progressiveChunkGindex(elementIndex)
            );
    }

    /// @notice Returns a chunk's generalized index relative to a progressive chunks root.
    /// @dev Finds the containing subtree among sizes 1, 4, 16, ... . Subtree n is reached
    /// through n right edges and one left edge, then 2*n bits select the chunk within it.
    /// Callers must supply indices whose arithmetic and generalized paths fit in uint256.
    /// @param chunkIndex The zero-based chunk index across all progressive subtrees.
    /// @return The chunks-root-relative generalized index, excluding the list length mix-in.
    function progressiveChunkGindex(uint256 chunkIndex)
        internal
        pure
        returns (uint256)
    {
        uint256 subtreeIndex;
        uint256 subtreeStart;
        uint256 subtreeLength = PROGRESSIVE_LIST_BASE_CHUNK_COUNT;

        while (chunkIndex >= subtreeStart + subtreeLength) {
            subtreeStart += subtreeLength;
            subtreeLength *= PROGRESSIVE_LIST_SCALING_FACTOR;
            subtreeIndex++;
        }

        uint256 gindex = 1;
        for (uint256 i = 0; i < subtreeIndex; i++) {
            gindex = (gindex << 1) | 1;
        }

        gindex = gindex << 1;
        return
            BeaconProofsLib.concatGenIndices(
                gindex,
                subtreeIndex * 2,
                chunkIndex - subtreeStart
            );
    }

    /// @notice Concatenates a root-relative path with a path relative to its target node.
    /// @dev Removes index2's leading root bit before appending its path bits. Callers must
    /// provide nonzero generalized indices whose combined path fits in uint256.
    /// @param index1 The outer generalized index.
    /// @param index2 The inner generalized index relative to the node selected by index1.
    /// @return The combined generalized index.
    function concatGeneralizedIndices(uint256 index1, uint256 index2)
        internal
        pure
        returns (uint256)
    {
        uint256 height = bitLength(index2) - 1;
        return
            BeaconProofsLib.concatGenIndices(
                index1,
                height,
                index2 - (1 << height)
            );
    }

    /// @notice Encodes a zero-based position at a given tree depth as a generalized index.
    /// @dev Uses (1 << height) | index without bounds checks; callers must ensure
    /// height < 256 and index < 2**height.
    /// @param height The number of edges from the root to the target node.
    /// @param index The zero-based position at that depth.
    /// @return The generalized index with its leading root bit set.
    function toGindex(uint256 height, uint256 index)
        internal
        pure
        returns (uint256)
    {
        return (1 << height) | index;
    }

    /// @notice Returns the number of bits needed to represent a value.
    /// @param value The unsigned value to measure.
    /// @return Zero for zero, otherwise floor(log2(value)) + 1.
    function bitLength(uint256 value) internal pure returns (uint256) {
        uint256 length;
        while (value > 0) {
            value >>= 1;
            length++;
        }
        return length;
    }

    /// @notice Checks that a proof has exactly one 32-byte witness per path level.
    /// @dev Checks only length, not inclusion. A zero generalized index reverts on subtraction.
    /// @param proof The concatenated sibling hashes to measure.
    /// @param generalizedIndex The nonzero generalized index of the proven node.
    /// @return True when proof.length equals (bitLength(generalizedIndex) - 1) * 32.
    function hasValidProofLength(bytes calldata proof, uint256 generalizedIndex)
        internal
        pure
        returns (bool)
    {
        return proof.length == (bitLength(generalizedIndex) - 1) * 32;
    }
}

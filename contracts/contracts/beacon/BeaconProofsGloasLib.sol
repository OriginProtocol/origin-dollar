// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconProofsLib } from "./BeaconProofsLib.sol";
import { Merkle } from "./Merkle.sol";
import { Endian } from "./Endian.sol";

/**
 * @title Library to verify Glamsterdam/Gloas merkle proofs of beacon chain data.
 * @author Origin Protocol Inc
 */
library BeaconProofsGloasLib {
    uint256 internal constant BEACON_BLOCK_STATE_ROOT_GENERALIZED_INDEX = 11;
    uint256 internal constant BEACON_STATE_VALIDATORS_GENERALIZED_INDEX = 358;
    uint256 internal constant BEACON_STATE_BALANCES_GENERALIZED_INDEX = 359;
    uint256 internal constant BEACON_STATE_PENDING_DEPOSITS_GENERALIZED_INDEX =
        2957;
    uint256 internal constant PROGRESSIVE_LIST_CHUNKS_GENERALIZED_INDEX = 2;
    uint256 internal constant PROGRESSIVE_LIST_BASE_CHUNK_COUNT = 1;
    uint256 internal constant PROGRESSIVE_LIST_SCALING_FACTOR = 4;
    uint256 internal constant BALANCES_PER_LEAF = 4;
    uint256 internal constant VALIDATOR_CONTAINER_HEIGHT = 3;
    uint256 internal constant VALIDATOR_PUBKEY_INDEX = 0;
    uint256 internal constant VALIDATOR_WITHDRAWABLE_EPOCH_INDEX = 7;
    uint256 internal constant PENDING_DEPOSIT_CONTAINER_HEIGHT = 3;
    uint256 internal constant PENDING_DEPOSIT_SLOT_INDEX = 4;

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

    function validatorsContainerGindex() internal pure returns (uint256) {
        return
            concatGeneralizedIndices(
                BEACON_BLOCK_STATE_ROOT_GENERALIZED_INDEX,
                BEACON_STATE_VALIDATORS_GENERALIZED_INDEX
            );
    }

    function balancesContainerGindex() internal pure returns (uint256) {
        return
            concatGeneralizedIndices(
                BEACON_BLOCK_STATE_ROOT_GENERALIZED_INDEX,
                BEACON_STATE_BALANCES_GENERALIZED_INDEX
            );
    }

    function pendingDepositsContainerGindex() internal pure returns (uint256) {
        return
            concatGeneralizedIndices(
                BEACON_BLOCK_STATE_ROOT_GENERALIZED_INDEX,
                BEACON_STATE_PENDING_DEPOSITS_GENERALIZED_INDEX
            );
    }

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

    function toGindex(uint256 height, uint256 index)
        internal
        pure
        returns (uint256)
    {
        return (1 << height) | index;
    }

    function bitLength(uint256 value) internal pure returns (uint256) {
        uint256 length;
        while (value > 0) {
            value >>= 1;
            length++;
        }
        return length;
    }

    function hasValidProofLength(bytes calldata proof, uint256 generalizedIndex)
        internal
        pure
        returns (bool)
    {
        return proof.length == (bitLength(generalizedIndex) - 1) * 32;
    }
}

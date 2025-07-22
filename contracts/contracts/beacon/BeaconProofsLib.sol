// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Merkle } from "./Merkle.sol";
import { Endian } from "./Endian.sol";

library BeaconProofsLib {
    // Known generalized indices in the beacon block
    // BeaconBlock.slot
    uint256 internal constant SLOT_GENERALIZED_INDEX = 8;
    // BeaconBlock.state.PendingDeposits[0].slot
    uint256 internal constant FIRST_PENDING_DEPOSIT_SLOT_GENERALIZED_INDEX =
        1584842932228;
    // BeaconBlock.body.executionPayload.blockNumber
    uint256 internal constant BLOCK_NUMBER_GENERALIZED_INDEX = 6438;
    // BeaconBlock.state.validators
    uint256 internal constant VALIDATORS_CONTAINER_GENERALIZED_INDEX = 715;
    // BeaconBlock.state.balances
    uint256 internal constant BALANCES_CONTAINER_GENERALIZED_INDEX = 716;

    // Beacon Container Tree Heights
    uint256 internal constant BALANCES_HEIGHT = 39;
    uint256 internal constant VALIDATORS_HEIGHT = 41;
    uint256 internal constant VALIDATOR_HEIGHT = 3;

    /// @notice Fields in the Validator container for phase 0
    /// See https://ethereum.github.io/consensus-specs/specs/phase0/beacon-chain/#validator
    uint256 internal constant VALIDATOR_PUBKEY_INDEX = 0;

    enum BalanceProofLevel {
        Container,
        BeaconBlock
    }

    /// @notice Verifies the validator public key against the beacon block root
    /// BeaconBlock.state.validators[validatorIndex].pubkey
    /// @param beaconBlockRoot The root of the beacon block
    /// @param pubKeyHash The beacon chain hash of the validator public key
    /// @param validatorPubKeyProof The merkle proof for the validator public key to the beacon block root.
    /// This is the witness hashes concatenated together starting from the leaf node.
    /// @param validatorIndex The validator index
    /// @param withdrawalAddress The withdrawal address used in the validator's withdrawal credentials
    function verifyValidatorPubkey(
        bytes32 beaconBlockRoot,
        bytes32 pubKeyHash,
        bytes calldata validatorPubKeyProof,
        uint64 validatorIndex,
        address withdrawalAddress
    ) internal view {
        // BeaconBlock.state.validators[validatorIndex].pubkey
        uint256 generalizedIndex = concatGenIndices(
            VALIDATORS_CONTAINER_GENERALIZED_INDEX,
            VALIDATORS_HEIGHT,
            validatorIndex
        );
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
            calldatacopy(0, validatorPubKeyProof.offset, 32)
            // Cast the 32 bytes in memory to an address which is the last 20 bytes.
            withdrawalAddressFromProof := mload(0)
        }
        require(
            withdrawalAddressFromProof == withdrawalAddress,
            "Invalid withdrawal address"
        );

        require(
            Merkle.verifyInclusionSha256({
                proof: validatorPubKeyProof,
                root: beaconBlockRoot,
                leaf: pubKeyHash,
                index: generalizedIndex
            }),
            "Invalid validator pubkey proof"
        );
    }

    /// @notice Verifies the balances container against the beacon block root
    /// BeaconBlock.state.balances
    /// @param beaconBlockRoot The root of the beacon block
    /// @param balancesContainerLeaf The leaf node containing the balances container
    /// @param balancesContainerProof The merkle proof for the balances container to the beacon block root.
    /// This is the witness hashes concatenated together starting from the leaf node.
    function verifyBalancesContainer(
        bytes32 beaconBlockRoot,
        bytes32 balancesContainerLeaf,
        bytes calldata balancesContainerProof
    ) internal view {
        // BeaconBlock.state.balances
        require(
            Merkle.verifyInclusionSha256({
                proof: balancesContainerProof,
                root: beaconBlockRoot,
                leaf: balancesContainerLeaf,
                index: BALANCES_CONTAINER_GENERALIZED_INDEX
            }),
            "Invalid balance container proof"
        );
    }

    /// @notice Verifies the validator balance against the root of the Balances container
    /// or the beacon block root
    /// @param root The root of the Balances container or the beacon block root
    /// @param validatorBalanceLeaf The leaf node containing the validator balance with three other balances
    /// @param balanceProof The merkle proof for the validator balance against the root.
    /// This is the witness hashes concatenated together starting from the leaf node.
    /// @param validatorIndex The validator index to verify the balance for
    /// @param level The level of the balance proof, either Container or BeaconBlock
    /// @return validatorBalanceGwei The balance in Gwei of the validator at the given index
    function verifyValidatorBalance(
        bytes32 root,
        bytes32 validatorBalanceLeaf,
        bytes calldata balanceProof,
        uint64 validatorIndex,
        BalanceProofLevel level
    ) internal view returns (uint256 validatorBalanceGwei) {
        // Four balances are stored in each leaf so the validator index is divided by 4
        uint64 balanceIndex = validatorIndex / 4;

        uint256 generalizedIndex;
        if (level == BalanceProofLevel.Container) {
            // Get the index within the balances container, not the Beacon Block
            // BeaconBlock.state.balances[balanceIndex]
            generalizedIndex = concatGenIndices(
                1,
                BALANCES_HEIGHT,
                balanceIndex
            );
        }

        if (level == BalanceProofLevel.BeaconBlock) {
            generalizedIndex = concatGenIndices(
                BALANCES_CONTAINER_GENERALIZED_INDEX,
                BALANCES_HEIGHT,
                balanceIndex
            );
        }

        validatorBalanceGwei = balanceAtIndex(
            validatorBalanceLeaf,
            validatorIndex
        );

        require(
            Merkle.verifyInclusionSha256({
                proof: balanceProof,
                root: root,
                leaf: validatorBalanceLeaf,
                index: generalizedIndex
            }),
            "Invalid balance container proof"
        );
    }

    /// @notice Verifies the slot of the first pending deposit against the beacon block root
    /// BeaconBlock.state.PendingDeposits[0].slot
    /// @param beaconBlockRoot The root of the beacon block
    /// @param slot The beacon chain slot to verify
    /// @param firstPendingDepositSlotProof The merkle proof for the first pending deposit's slot
    /// against the beacon block root.
    /// This is the witness hashes concatenated together starting from the leaf node.
    function verifyFirstPendingDepositSlot(
        bytes32 beaconBlockRoot,
        uint64 slot,
        bytes calldata firstPendingDepositSlotProof
    ) internal view {
        // Convert uint64 slot number to a little endian bytes32
        bytes32 slotLeaf = Endian.toLittleEndianUint64(slot);

        require(
            Merkle.verifyInclusionSha256({
                proof: firstPendingDepositSlotProof,
                root: beaconBlockRoot,
                leaf: slotLeaf,
                index: FIRST_PENDING_DEPOSIT_SLOT_GENERALIZED_INDEX
            }),
            "Invalid pending deposit proof"
        );
    }

    /// @notice Verifies the block number to the the beacon block root
    /// BeaconBlock.body.executionPayload.blockNumber
    /// @param beaconBlockRoot The root of the beacon block
    /// @param blockNumber The execution layer block number to verify
    /// @param blockNumberProof The merkle proof for the block number against the beacon block
    /// This is the witness hashes concatenated together starting from the leaf node.
    function verifyBlockNumber(
        bytes32 beaconBlockRoot,
        uint256 blockNumber,
        bytes calldata blockNumberProof
    ) internal view {
        // Convert uint64 block number to a little endian bytes32
        bytes32 blockNumberLeaf = Endian.toLittleEndianUint64(
            uint64(blockNumber)
        );
        require(
            Merkle.verifyInclusionSha256({
                proof: blockNumberProof,
                root: beaconBlockRoot,
                leaf: blockNumberLeaf,
                index: BLOCK_NUMBER_GENERALIZED_INDEX
            }),
            "Invalid block number proof"
        );
    }

    /// @notice Verifies the slot number against the beacon block root.
    /// BeaconBlock.slot
    /// @param beaconBlockRoot The root of the beacon block
    /// @param slot The beacon chain slot to verify
    /// @param slotProof The merkle proof for the slot against the beacon block root.
    /// This is the witness hashes concatenated together starting from the leaf node.
    function verifySlot(
        bytes32 beaconBlockRoot,
        uint256 slot,
        bytes calldata slotProof
    ) internal view {
        require(
            Merkle.verifyInclusionSha256({
                proof: slotProof,
                root: beaconBlockRoot,
                leaf: Endian.toLittleEndianUint64(uint64(slot)),
                index: SLOT_GENERALIZED_INDEX
            }),
            "Invalid slot number proof"
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

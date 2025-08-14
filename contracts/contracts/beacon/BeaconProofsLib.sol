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
    /// @dev BeaconBlock.slot
    uint256 internal constant SLOT_GENERALIZED_INDEX = 8;
    /// @dev BeaconBlock.state.PendingDeposits[0]
    uint256 internal constant FIRST_PENDING_DEPOSIT_GENERALIZED_INDEX =
        198105366528;
    /// @dev BeaconBlock.state.PendingDeposits[0].slot
    uint256 internal constant FIRST_PENDING_DEPOSIT_SLOT_GENERALIZED_INDEX =
        1584842932228;
    /// @dev BeaconBlock.body.executionPayload.blockNumber
    uint256 internal constant BLOCK_NUMBER_GENERALIZED_INDEX = 6438;
    /// @dev BeaconBlock.state.validators
    uint256 internal constant VALIDATORS_CONTAINER_GENERALIZED_INDEX = 715;
    /// @dev BeaconBlock.state.balances
    uint256 internal constant BALANCES_CONTAINER_GENERALIZED_INDEX = 716;

    /// @dev Number of bytes in the proof to the first pending deposit.
    /// 37 witness hashes of 32 bytes each concatenated together.
    /// BeaconBlock.state.PendingDeposits[0]
    uint256 internal constant FIRST_PENDING_DEPOSIT_PROOF_LENGTH = 37 * 32;
    /// @dev Number of bytes in the proof to the slot of the first pending deposit.
    /// 40 witness hashes of 32 bytes each concatenated together.
    /// BeaconBlock.state.PendingDeposits[0].slot
    uint256 internal constant FIRST_PENDING_DEPOSIT_SLOT_PROOF_LENGTH = 40 * 32;

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

    /// @notice Verifies the balances container to the beacon block root.
    /// BeaconBlock.state.balances
    /// @param beaconBlockRoot The root of the beacon block.
    /// @param balancesContainerRoot The merkle root of the the balances container.
    /// @param balancesContainerProof The merkle proof for the balances container to the beacon block root.
    /// This is 9 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    function verifyBalancesContainer(
        bytes32 beaconBlockRoot,
        bytes32 balancesContainerRoot,
        bytes calldata balancesContainerProof
    ) internal view {
        require(beaconBlockRoot != bytes32(0), "Invalid block root");
        require(
            // 9 * 32 bytes = 288 bytes
            balancesContainerProof.length == 288,
            "Invalid proof length"
        );

        // BeaconBlock.state.balances
        require(
            Merkle.verifyInclusionSha256({
                proof: balancesContainerProof,
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
        require(
            // 39 * 32 bytes = 1248 bytes
            balanceProof.length == 1248,
            "Invalid proof length"
        );

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
            Merkle.verifyInclusionSha256({
                proof: balanceProof,
                root: balancesContainerRoot,
                leaf: validatorBalanceLeaf,
                index: generalizedIndex
            }),
            "Invalid balance proof"
        );
    }

    /// @notice If the deposit queue is not empty,
    /// verify the slot of the first pending deposit to the beacon block root
    /// BeaconBlock.state.PendingDeposits[0].slot
    /// If the deposit queue is empty, verify the root of the first pending deposit is empty
    /// BeaconBlock.state.PendingDeposits[0]
    /// @param beaconBlockRoot The root of the beacon block.
    /// @param slot The beacon chain slot of the first deposit in the beacon chain's deposit queue.
    /// Can be anything if the deposit queue is empty, but zero would be a good choice.
    /// @param firstPendingDepositSlotProof The merkle proof to the beacon block root. Can be either:
    /// - 40 witness hashes for BeaconBlock.state.PendingDeposits[0].slot when the deposit queue is not empty.
    /// - 37 witness hashes for BeaconBlock.state.PendingDeposits[0] when the deposit queue is empty.
    /// The 32 byte witness hashes are concatenated together starting from the leaf node.
    /// @return isEmptyDepositQueue True if the deposit queue is empty, false otherwise.
    function verifyFirstPendingDepositSlot(
        bytes32 beaconBlockRoot,
        uint64 slot,
        bytes calldata firstPendingDepositSlotProof
    ) internal view returns (bool isEmptyDepositQueue) {
        require(beaconBlockRoot != bytes32(0), "Invalid block root");
        require(
            // 40 * 32 bytes = 1280 bytes
            firstPendingDepositSlotProof.length == 1280 ||
                // 37 * 32 bytes = 1184 bytes
                firstPendingDepositSlotProof.length == 1184,
            "Invalid proof length"
        );

        // slither-disable-next-line uninitialized-local
        uint256 generalizedIndex;
        // slither-disable-next-line uninitialized-local
        bytes32 leaf;
        // If the deposit queue is empty
        if (
            firstPendingDepositSlotProof.length ==
            FIRST_PENDING_DEPOSIT_PROOF_LENGTH
        ) {
            isEmptyDepositQueue = true;
            // use an empty leaf node as the root of the first pending deposit
            // when the deposit queue is empty
            leaf = bytes32(0);
            // BeaconBlock.state.PendingDeposits[0]
            generalizedIndex = FIRST_PENDING_DEPOSIT_GENERALIZED_INDEX;
        } else if (
            firstPendingDepositSlotProof.length ==
            FIRST_PENDING_DEPOSIT_SLOT_PROOF_LENGTH
        ) {
            // Convert uint64 slot number to a little endian bytes32
            leaf = Endian.toLittleEndianUint64(slot);
            // BeaconBlock.state.PendingDeposits[0].slot
            generalizedIndex = FIRST_PENDING_DEPOSIT_SLOT_GENERALIZED_INDEX;
        } else {
            revert("Invalid proof length");
        }

        require(
            Merkle.verifyInclusionSha256({
                proof: firstPendingDepositSlotProof,
                root: beaconBlockRoot,
                leaf: leaf,
                index: generalizedIndex
            }),
            "Invalid pending deposit proof"
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

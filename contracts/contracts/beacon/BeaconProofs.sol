// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconProofsLib } from "./BeaconProofsLib.sol";

contract BeaconProofs {
    /// @notice Verifies the validator public key against the beacon block root
    /// BeaconBlock.state.validators[validatorIndex].pubkey
    /// @param beaconBlockRoot The root of the beacon block
    /// @param pubKeyHash The beacon chain hash of the validator public key
    /// @param validatorPubKeyProof The merkle proof for the validator public key to the beacon block root.
    /// This is the witness hashes concatenated together starting from the leaf node.
    /// @param validatorIndex The validator index
    function verifyValidatorPubkey(
        bytes32 beaconBlockRoot,
        bytes32 pubKeyHash,
        bytes calldata validatorPubKeyProof,
        uint64 validatorIndex,
        address withdrawalAddress
    ) external view {
        BeaconProofsLib.verifyValidatorPubkey(
            beaconBlockRoot,
            pubKeyHash,
            validatorPubKeyProof,
            validatorIndex,
            withdrawalAddress
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
    ) external view {
        BeaconProofsLib.verifyBalancesContainer(
            beaconBlockRoot,
            balancesContainerLeaf,
            balancesContainerProof
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
        BeaconProofsLib.BalanceProofLevel level
    ) external view returns (uint256 validatorBalanceGwei) {
        validatorBalanceGwei = BeaconProofsLib.verifyValidatorBalance(
            root,
            validatorBalanceLeaf,
            balanceProof,
            validatorIndex,
            level
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
    ) external view {
        BeaconProofsLib.verifyFirstPendingDepositSlot(
            beaconBlockRoot,
            slot,
            firstPendingDepositSlotProof
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
    ) external view {
        BeaconProofsLib.verifyBlockNumber(
            beaconBlockRoot,
            blockNumber,
            blockNumberProof
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
    ) external view {
        BeaconProofsLib.verifySlot(beaconBlockRoot, slot, slotProof);
    }

    function verifyHistoricalSlot(
        bytes32 proofBlockRoot,
        bytes32 historicalBlockRoot,
        uint64 blockNumber,
        uint64 slot,
        bytes calldata historicalBlockRootProof,
        bytes calldata slotProof,
        bytes calldata blockProof
    ) external view {
        BeaconProofsLib.verifyHistoricalSlot(
            proofBlockRoot,
            historicalBlockRoot,
            slot,
            blockNumber,
            historicalBlockRootProof,
            slotProof,
            blockProof
        );
    }
}

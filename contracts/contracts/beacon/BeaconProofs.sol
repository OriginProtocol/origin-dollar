// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Merkle } from "./Merkle.sol";
import { Endian } from "./Endian.sol";

library BeaconProofs {
    // Known generalized indices in the beacon block
    // BeaconBlock.slot
    uint256 internal constant SLOT_GENERALIZED_INDEX = 8;
    // BeaconBlock.state.PendingDeposits[0].slot
    uint256 internal constant FIRST_PENDING_DEPOSIT_SLOT_GENERALIZED_INDEX =
        1584842932228;
    // BeaconBlock.body.executionPayload.blockNumber
    uint256 internal constant BLOCK_NUMBER_GENERALIZED_INDEX = 6438;

    // Beacon Container Tree Heights
    uint256 internal constant BEACON_BLOCK_HEIGHT = 3;
    uint256 internal constant BEACON_STATE_HEIGHT = 6;
    uint256 internal constant BEACON_BLOCK_BODY_HEIGHT = 4;
    uint256 internal constant EXECUTION_PAYLOAD_HEIGHT = 5;
    uint256 internal constant PENDING_DEPOSITS_HEIGHT = 28;
    uint256 internal constant PENDING_DEPOSIT_HEIGHT = 3;
    uint256 internal constant BALANCES_HEIGHT = 39;
    uint256 internal constant VALIDATORS_HEIGHT = 41;
    uint256 internal constant VALIDATOR_HEIGHT = 3;

    /// @notice Fields in the BeaconBlock container for phase 0
    /// https://ethereum.github.io/consensus-specs/specs/phase0/beacon-chain/#beaconblock
    uint256 internal constant BEACON_BLOCK_SLOT_INDEX = 0;
    uint256 internal constant BEACON_BLOCK_STATE_INDEX = 3;
    uint256 internal constant BEACON_BLOCK_BODY_INDEX = 4;

    /// @notice Fields in the BeaconState container for Electra
    /// See https://ethereum.github.io/consensus-specs/specs/electra/beacon-chain/#beaconstate
    uint256 internal constant STATE_VALIDATORS_INDEX = 11;
    uint256 internal constant STATE_BALANCES_INDEX = 12;
    uint256 internal constant STATE_PENDING_DEPOSITS_INDEX = 34;

    /// @notice Fields in the Validator container for phase 0
    /// See https://ethereum.github.io/consensus-specs/specs/phase0/beacon-chain/#validator
    uint256 internal constant VALIDATOR_PUBKEY_INDEX = 0;

    /// @notice Fields in the PendingDeposit container for Electra
    /// See https://ethereum.github.io/consensus-specs/specs/electra/beacon-chain/#pendingdeposit
    uint256 internal constant PENDING_DEPOSIT_SLOT_INDEX = 4;

    /// @notice Fields in the ExecutionPayload container for Electra
    /// https://ethereum.github.io/consensus-specs/specs/electra/beacon-chain/#beaconblockbody
    uint256 internal constant BEACON_BLOCK_BODY_EXECUTION_PAYLOAD_INDEX = 9;

    /// @notice Fields in the ExecutionPayload container for Deneb
    /// See https://ethereum.github.io/consensus-specs/specs/deneb/beacon-chain/#executionpayload
    uint256 internal constant EXECUTION_PAYLOAD_BLOCK_NUMBER_INDEX = 6;

    struct TreeNode {
        uint256 height;
        uint256 index;
    }

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
    function verifyValidatorPubkey(
        bytes32 beaconBlockRoot,
        bytes32 pubKeyHash,
        bytes calldata validatorPubKeyProof,
        uint64 validatorIndex
    ) internal view {
        // BeaconBlock.state.validators[validatorIndex].pubkey
        TreeNode[] memory nodes = new TreeNode[](4);
        // TODO might be easier to read and more gas efficient for the static nodes to be constant
        nodes[0] = TreeNode({
            height: BEACON_BLOCK_HEIGHT,
            index: BEACON_BLOCK_STATE_INDEX
        });
        nodes[1] = TreeNode({
            height: BEACON_STATE_HEIGHT,
            index: STATE_VALIDATORS_INDEX
        });
        // this is a dynamic generalized index
        nodes[2] = TreeNode({
            height: VALIDATORS_HEIGHT,
            index: validatorIndex
        });
        nodes[3] = TreeNode({
            height: VALIDATOR_HEIGHT,
            index: VALIDATOR_PUBKEY_INDEX
        });
        uint256 generalizedIndex = generalizeIndex(nodes);

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
        // TODO This the generalized index is a fixed so can replace with a constant
        TreeNode[] memory nodes = new TreeNode[](2);
        nodes[0] = TreeNode({
            height: BEACON_BLOCK_HEIGHT,
            index: BEACON_BLOCK_STATE_INDEX
        });
        nodes[1] = TreeNode({
            height: BEACON_STATE_HEIGHT,
            index: STATE_BALANCES_INDEX
        });
        uint256 generalizedIndex = generalizeIndex(nodes);

        require(
            Merkle.verifyInclusionSha256({
                proof: balancesContainerProof,
                root: beaconBlockRoot,
                leaf: balancesContainerLeaf,
                index: generalizedIndex
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
    function verifyValidatorBalance(
        bytes32 root,
        bytes32 validatorBalanceLeaf,
        bytes calldata balanceProof,
        uint64 validatorIndex,
        BalanceProofLevel level
    ) internal view returns (uint256 validatorBalance) {
        // Four balances are stored in each leaf so the validator index is divided by 4
        uint64 balanceIndex = validatorIndex / 4;

        uint256 generalizedIndex;
        if (level == BalanceProofLevel.Container) {
            // Get the index within the balances container, not the Beacon Block
            // BeaconBlock.state.balances[balanceIndex]
            generalizedIndex = generalizeIndex(BALANCES_HEIGHT, balanceIndex);
        }

        if (level == BalanceProofLevel.BeaconBlock) {
            // Get the generalized index to the beacon block
            // TODO This the generalized index is a fixed so can replace with a constant
            TreeNode[] memory nodes = new TreeNode[](3);
            nodes[0] = TreeNode({
                height: BEACON_BLOCK_HEIGHT,
                index: BEACON_BLOCK_STATE_INDEX
            });
            nodes[1] = TreeNode({
                height: BEACON_STATE_HEIGHT,
                index: STATE_BALANCES_INDEX
            });
            nodes[2] = TreeNode({
                height: BALANCES_HEIGHT,
                index: balanceIndex
            });

            generalizedIndex = generalizeIndex(nodes);
        }

        validatorBalance = balanceAtIndex(validatorBalanceLeaf, validatorIndex);

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

    function generalizeIndex(TreeNode[] memory nodes)
        internal
        pure
        returns (uint256 index)
    {
        index = 1;
        for (uint256 i; i < nodes.length; ++i) {
            // generalized index = 2 ^ tree height + node index
            index = (index << nodes[i].height) | nodes[i].index;
        }
    }

    function generalizeIndex(uint256 height, uint256 index)
        internal
        pure
        returns (uint256 genIndex)
    {
        // 2 ^ tree height + node index
        genIndex = (1 << height) | index;
    }
}

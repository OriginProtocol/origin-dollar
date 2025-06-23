// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Merkle } from "./Merkle.sol";
import { Endian } from "./Endian.sol";

library BeaconProofs {
    uint256 internal constant SLOT_GEN_INDEX = 8;

    // Beacon Container Tree Heights
    uint256 internal constant BEACON_BLOCK_HEIGHT = 3;
    uint256 internal constant BEACON_STATE_HEIGHT = 6;
    uint256 internal constant BEACON_BLOCK_BODY_HEIGHT = 4;
    uint256 internal constant EXECUTION_PAYLOAD_HEIGHT = 5;
    uint256 internal constant PENDING_DEPOSIT_HEIGHT = 28;
    uint256 internal constant BALANCES_HEIGHT = 38;
    uint256 internal constant VALIDATORS_HEIGHT = 40;
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

    function generalizeIndex(TreeNode[] memory nodes)
        internal
        pure
        returns (uint256 index)
    {
        uint256 height = 0;
        for (uint256 i; i < nodes.length; ++i) {
            // generalized index = 2 ^ tree height + node index
            index = (nodes[i].index << height) | index;
            height += nodes[i].height;
        }

        // plus 2 ^ total height
        index = (1 << height) | index;
    }

    function verifyValidatorPubkey(
        bytes32 blockRoot,
        bytes32 pubKeyHash,
        uint256 validatorIndex,
        bytes calldata validatorPubKeyProof
    ) external view {
        // BeaconBlock.state.validators[validatorIndex].pubkey
        TreeNode[] memory nodes = new TreeNode[](4);
        // TODO might be easier to read and more gas efficient for the static nodes to be constant
        nodes[0] = TreeNode({
            height: VALIDATOR_HEIGHT,
            index: VALIDATOR_PUBKEY_INDEX
        });
        // this is a dynamic generalized index
        nodes[1] = TreeNode({
            height: VALIDATORS_HEIGHT,
            index: validatorIndex
        });
        nodes[2] = TreeNode({
            height: BEACON_STATE_HEIGHT,
            index: STATE_VALIDATORS_INDEX
        });
        nodes[3] = TreeNode({
            height: BEACON_BLOCK_HEIGHT,
            index: BEACON_BLOCK_STATE_INDEX
        });

        uint256 generalizedIndex = BeaconProofs.generalizeIndex(nodes);

        require(
            Merkle.verifyInclusionSha256({
                proof: validatorPubKeyProof,
                root: blockRoot,
                leaf: pubKeyHash,
                index: generalizedIndex
            }),
            "Invalid validator pubkey proof"
        );
    }

    function verifyFirstPendingDepositSlot(
        bytes32 blockRoot,
        uint64 slot,
        bytes calldata firstPendingDepositSlot
    ) external view {
        // BeaconBlock.state.PendingDeposits[0].slot
        TreeNode[] memory nodes = new TreeNode[](4);
        nodes[0] = TreeNode({
            height: PENDING_DEPOSIT_HEIGHT,
            index: PENDING_DEPOSIT_SLOT_INDEX
        });
        // We want the first pending deposit so index 0
        nodes[1] = TreeNode({ height: PENDING_DEPOSIT_HEIGHT, index: 0 });
        nodes[2] = TreeNode({
            height: BEACON_STATE_HEIGHT,
            index: STATE_PENDING_DEPOSITS_INDEX
        });
        nodes[3] = TreeNode({
            height: BEACON_BLOCK_HEIGHT,
            index: BEACON_BLOCK_STATE_INDEX
        });

        uint256 generalizedIndex = BeaconProofs.generalizeIndex(nodes);

        // Convert uint64 slot number to a little endian bytes32
        bytes32 slotRoot = Endian.toLittleEndianUint64(slot);

        require(
            Merkle.verifyInclusionSha256({
                proof: firstPendingDepositSlot,
                root: blockRoot,
                leaf: slotRoot,
                index: generalizedIndex
            }),
            "Invalid pending deposit proof"
        );
    }

    function verifyBlockNumber(
        bytes32 blockRoot,
        uint256 blockNumber,
        bytes calldata blockNumberProof
    ) external view {
        // BeaconBlock.body.executionPayload.blockNumber
        TreeNode[] memory nodes = new TreeNode[](3);
        // TODO might be easier to read and more gas efficient for the static nodes to be constant
        nodes[0] = TreeNode({
            height: EXECUTION_PAYLOAD_HEIGHT,
            index: EXECUTION_PAYLOAD_BLOCK_NUMBER_INDEX
        });
        nodes[1] = TreeNode({
            height: BEACON_BLOCK_BODY_HEIGHT,
            index: BEACON_BLOCK_BODY_EXECUTION_PAYLOAD_INDEX
        });
        nodes[3] = TreeNode({
            height: BEACON_BLOCK_HEIGHT,
            index: BEACON_BLOCK_BODY_INDEX
        });

        uint256 generalizedIndex = BeaconProofs.generalizeIndex(nodes);

        require(
            Merkle.verifyInclusionSha256({
                proof: blockNumberProof,
                root: blockRoot,
                leaf: Endian.toLittleEndianUint64(uint64(blockNumber)),
                index: generalizedIndex
            }),
            "Invalid block number proof"
        );
    }

    function verifySlot(
        bytes32 blockRoot,
        uint256 slot,
        bytes calldata blockNumberProof
    ) external view {
        // BeaconBlock.slot
        // TreeNode[] memory nodes = new TreeNode[](1);
        // nodes[0] = TreeNode({
        //     height: BEACON_BLOCK_HEIGHT,
        //     index: BEACON_BLOCK_SLOT_INDEX
        // });
        // uint256 generalizedIndex = BeaconProofs.generalizeIndex(nodes);

        require(
            Merkle.verifyInclusionSha256({
                proof: blockNumberProof,
                root: blockRoot,
                leaf: Endian.toLittleEndianUint64(uint64(slot)),
                index: SLOT_GEN_INDEX
            }),
            "Invalid slot number proof"
        );
    }
}

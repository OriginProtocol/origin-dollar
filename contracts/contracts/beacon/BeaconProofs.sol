// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Merkle } from "./Merkle.sol";
import { Endian } from "./Endian.sol";

library BeaconProofs {
    uint256 internal constant SLOT_GENERALIZED_INDEX = 8;

    // Beacon Container Tree Heights
    uint256 internal constant BEACON_BLOCK_HEIGHT = 3;
    uint256 internal constant BEACON_STATE_HEIGHT = 6;
    uint256 internal constant BEACON_BLOCK_BODY_HEIGHT = 4;
    uint256 internal constant EXECUTION_PAYLOAD_HEIGHT = 5;
    uint256 internal constant PENDING_DEPOSIT_HEIGHT = 28;
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

    function verifyValidatorPubkey(
        bytes32 beaconBlockRoot,
        bytes32 pubKeyHash,
        bytes calldata validatorPubKeyProof,
        uint256 validatorIndex
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

    function verifyValidatorBalance(
        bytes32 balancesContainerRoot,
        bytes32 validatorBalanceLeaf,
        bytes calldata balanceProof,
        uint256 validatorIndex
    ) internal view returns (uint256 validatorBalance) {
        // Four balances are stored in each leaf so the validator index is divided by 4
        uint256 balanceIndex = uint256(validatorIndex / 4);

        // BeaconBlock.state.balances[balanceIndex]
        uint256 generalizedIndex = generalizeIndex(
            BALANCES_HEIGHT,
            balanceIndex
        );

        require(
            Merkle.verifyInclusionSha256({
                proof: balanceProof,
                root: balancesContainerRoot,
                leaf: validatorBalanceLeaf,
                index: generalizedIndex
            }),
            "Invalid balance container proof"
        );

        validatorBalance = balanceAtIndex(
            validatorBalanceLeaf,
            uint40(validatorIndex)
        );
    }

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

    function verifyFirstPendingDepositSlot(
        bytes32 blockRoot,
        uint64 slot,
        bytes calldata firstPendingDepositSlotProof
    ) internal view {
        // BeaconBlock.state.PendingDeposits[0].slot
        TreeNode[] memory nodes = new TreeNode[](4);
        nodes[0] = TreeNode({
            height: BEACON_BLOCK_HEIGHT,
            index: BEACON_BLOCK_STATE_INDEX
        });
        nodes[1] = TreeNode({
            height: BEACON_STATE_HEIGHT,
            index: STATE_PENDING_DEPOSITS_INDEX
        });
        // We want the first pending deposit so index 0
        nodes[2] = TreeNode({ height: PENDING_DEPOSIT_HEIGHT, index: 0 });
        nodes[3] = TreeNode({
            height: PENDING_DEPOSIT_HEIGHT,
            index: PENDING_DEPOSIT_SLOT_INDEX
        });
        uint256 generalizedIndex = generalizeIndex(nodes);

        // Convert uint64 slot number to a little endian bytes32
        bytes32 slotLeaf = Endian.toLittleEndianUint64(slot);
        require(
            Merkle.verifyInclusionSha256({
                proof: firstPendingDepositSlotProof,
                root: blockRoot,
                leaf: slotLeaf,
                index: generalizedIndex
            }),
            "Invalid pending deposit proof"
        );
    }

    function verifyBlockNumber(
        bytes32 beaconBlockRoot,
        uint256 blockNumber,
        bytes calldata blockNumberProof
    ) internal view {
        // BeaconBlock.body.executionPayload.blockNumber
        // TODO might be easier to read and more gas efficient for the static nodes to be constant
        TreeNode[] memory nodes = new TreeNode[](3);
        nodes[0] = TreeNode({
            height: BEACON_BLOCK_HEIGHT,
            index: BEACON_BLOCK_BODY_INDEX
        });
        nodes[1] = TreeNode({
            height: BEACON_BLOCK_BODY_HEIGHT,
            index: BEACON_BLOCK_BODY_EXECUTION_PAYLOAD_INDEX
        });
        nodes[2] = TreeNode({
            height: EXECUTION_PAYLOAD_HEIGHT,
            index: EXECUTION_PAYLOAD_BLOCK_NUMBER_INDEX
        });
        uint256 generalizedIndex = generalizeIndex(nodes);

        // Convert uint64 block number to a little endian bytes32
        bytes32 blockNumberLeaf = Endian.toLittleEndianUint64(
            uint64(blockNumber)
        );
        require(
            Merkle.verifyInclusionSha256({
                proof: blockNumberProof,
                root: beaconBlockRoot,
                leaf: blockNumberLeaf,
                index: generalizedIndex
            }),
            "Invalid block number proof"
        );
    }

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
}

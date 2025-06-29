// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconProofs } from "./BeaconProofs.sol";
import { BeaconRoots } from "./BeaconRoots.sol";

contract BeaconOracle {
    /// @notice Maps a block number to slot
    mapping(uint64 => uint64) private _blockToSlot;
    /// @notice Maps a slot to a number
    mapping(uint64 => uint64) private _slotToBlock;

    event BlockToSlot(
        bytes32 indexed blockRoot,
        uint64 indexed blockNumber,
        uint64 indexed slot
    );

    /// @notice Uses merkle a proof against the Beacon Block Root to link
    /// a block number to a beacon chain slot.
    /// @param nextBlockTimestamp The timestamp of the slot after the one being proven.
    /// @param blockNumber The execution layer block number.
    /// @param slot The beacon chain slot.
    /// @param slotProof The merkle proof witnesses for the slot against the Beacon Block Root.
    /// @param blockProof The merkle proof witnesses for the block number against the Beacon Block Root
    function proveSlot(
        uint64 nextBlockTimestamp,
        uint64 blockNumber,
        uint64 slot,
        bytes calldata slotProof,
        bytes calldata blockProof
    ) external returns (bytes32 blockRoot) {
        require(_blockToSlot[blockNumber] == 0, "Block already mapped");

        // Get the parent beacon block root for the given timestamp.
        // This is the beacon block root of the previous slot.
        blockRoot = BeaconRoots.parentBlockRoot(nextBlockTimestamp);

        // Verify the block number to the Beacon Block Root root
        BeaconProofs.verifyBlockNumber(blockRoot, blockNumber, blockProof);

        // Verify the slot to the Beacon Block Root root
        BeaconProofs.verifySlot(blockRoot, slot, slotProof);

        // Store mappings
        _blockToSlot[blockNumber] = slot;
        _slotToBlock[slot] = blockNumber;

        emit BlockToSlot(blockRoot, blockNumber, slot);
    }

    function blockToSlot(uint64 blockNumber)
        external
        view
        returns (uint64 slot)
    {
        slot = _blockToSlot[blockNumber];

        require(slot != 0, "Block not mapped");
    }

    function slotToBlock(uint64 slot)
        external
        view
        returns (uint64 blockNumber)
    {
        blockNumber = _slotToBlock[slot];

        require(blockNumber != 0, "Slot not mapped");
    }
}

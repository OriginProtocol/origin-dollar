// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { BeaconProofsLib } from "./BeaconProofsLib.sol";
import { BeaconRoots } from "./BeaconRoots.sol";

/// @title Beacon Chain Oracle
/// @notice An Oracle for mapping execution layer block numbers to beacon chain slots.
/// @author Origin Protocol Inc
contract BeaconOracle {
    /// @notice Maps a block number to slot
    mapping(uint64 => uint64) internal _blockToSlot;
    /// @notice Maps a slot to a number
    mapping(uint64 => uint64) internal _slotToBlock;
    /// @notice Maps a slot to a beacon block root
    mapping(uint64 => bytes32) internal _slotToRoot;

    event BlockToSlot(
        bytes32 indexed blockRoot,
        uint64 indexed blockNumber,
        uint64 indexed slot
    );

    /// @notice Uses merkle a proof against the beacon block root to link
    /// an execution layer block number to a beacon chain slot.
    /// @param nextBlockTimestamp The timestamp of the block after the one being proven.
    /// @param blockNumber The execution layer block number.
    /// @param slot The beacon chain slot.
    /// @param slotProof The merkle proof witnesses for the slot against the beacon block root.
    /// @param blockProof The merkle proof witnesses for the block number against the beacon block root.
    function verifySlot(
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

        // Verify the slot to the beacon block root
        BeaconProofsLib.verifySlot(blockRoot, slot, slotProof);

        // Verify the block number to the beacon block root
        BeaconProofsLib.verifyBlockNumber(blockRoot, blockNumber, blockProof);

        // Store mappings
        _blockToSlot[blockNumber] = slot;
        _slotToBlock[slot] = blockNumber;
        _slotToRoot[slot] = blockRoot;

        emit BlockToSlot(blockRoot, blockNumber, slot);
    }

    /// @notice Uses merkle a proof against the beacon block root to link
    /// an execution layer block number to a beacon chain slot.
    /// The slot being verified must be older than 8192 slots so it's beacon block root
    /// has been aggregated into the historical summaries.
    /// @param nextBlockTimestamp The timestamp of the block after the block used for verification.
    /// Used to get the the parent beacon block root from the beacon roots contract (EIP-4788).
    /// @param historicalBlockRoot The historical beacon block root of the slot and block being verified.
    /// @param blockNumber The historical execution layer block number.
    /// @param slot The historical beacon chain slot.
    /// @param historicalBlockRootProof The merkle proof witnesses for the historicalSummaries against the block root.
    /// @param slotProof The merkle proof witnesses for the slot against the historical block root.
    /// @param blockProof The merkle proof witnesses for the block number against the historical block root.
    function verifyHistoricalSlot(
        uint64 nextBlockTimestamp,
        bytes32 historicalBlockRoot,
        uint64 blockNumber,
        uint64 slot,
        bytes calldata historicalBlockRootProof,
        bytes calldata slotProof,
        bytes calldata blockProof
    ) external {
        require(_blockToSlot[blockNumber] == 0, "Block already mapped");

        // Get the parent beacon block root for the given timestamp.
        // This is the beacon block root of the previous slot.
        bytes32 proofBlockRoot = BeaconRoots.parentBlockRoot(
            nextBlockTimestamp
        );

        // Verify the slot to the beacon block root
        BeaconProofsLib.verifyHistoricalSlot(
            proofBlockRoot,
            historicalBlockRoot,
            slot,
            blockNumber,
            historicalBlockRootProof,
            slotProof,
            blockProof
        );

        // Store mappings
        _blockToSlot[blockNumber] = slot;
        _slotToBlock[slot] = blockNumber;
        _slotToRoot[slot] = historicalBlockRoot;

        emit BlockToSlot(historicalBlockRoot, blockNumber, slot);
    }

    /// @notice Returns the beacon chain slot for a given execution layer block number.
    function blockToSlot(uint64 blockNumber)
        external
        view
        returns (uint64 slot)
    {
        slot = _blockToSlot[blockNumber];

        require(slot != 0, "Block not mapped");
    }

    /// @notice Returns the execution layer block number for a given beacon chain slot.
    function slotToBlock(uint64 slot)
        external
        view
        returns (uint64 blockNumber)
    {
        blockNumber = _slotToBlock[slot];

        require(blockNumber != 0, "Slot not mapped");
    }

    /// @notice Returns the beacon block root for a given beacon chain slot.
    function slotToRoot(uint64 slot) external view returns (bytes32 blockRoot) {
        blockRoot = _slotToRoot[slot];

        require(blockRoot != 0, "Slot not mapped");
    }

    /// @notice Returns true if an execution layer block number has been mapped to a beacon chain slot.
    function isBlockMapped(uint64 blockNumber) external view returns (bool) {
        return _blockToSlot[blockNumber] != 0;
    }

    /// @notice Returns true if a beacon chain slot has been mapped to an execution layer block number.
    function isSlotMapped(uint64 slot) external view returns (bool) {
        return _slotToBlock[slot] != 0;
    }
}

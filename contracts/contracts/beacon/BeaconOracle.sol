// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconProofs } from "./BeaconProofs.sol";
import { BeaconRoots } from "./BeaconRoots.sol";

contract BeaconOracle {
    /// @notice Maps a block number to slot
    mapping(uint64 => uint64) public blockToSlot;
    /// @notice Maps a slot to a number
    mapping(uint64 => uint64) public slotToBlock;

    /// @notice Uses merkle a proof against the Beacon Block Root to link
    /// a block number to a beacon chain slot.
    /// @param parentTimestamp The timestamp of the slot after the one being proven.
    /// @param blockNumber The execution layer block number.
    /// @param slot The beacon chain slot.
    /// @param slotProof The merkle proof witnesses for the slot against the Beacon Block Root.
    /// @param blockProof The merkle proof witnesses for the block number against the Beacon Block Root
    function proveSlot(
        uint64 parentTimestamp,
        uint64 blockNumber,
        uint64 slot,
        bytes calldata slotProof,
        bytes calldata blockProof
    ) external {
        require(blockToSlot[blockNumber] == 0, "Block already mapped");

        // Get the parent beacon block root for the given timestamp.
        // This is the beacon block root of the previous slot.
        bytes32 blockRoot = BeaconRoots.parentBlockRoot(parentTimestamp);

        // Verify the block number to the Beacon Block Root root
        BeaconProofs.verifyBlockNumber(blockRoot, blockNumber, blockProof);

        // Verify the slot to the Beacon Block Root root
        BeaconProofs.verifySlot(blockRoot, slot, slotProof);

        // Store mappings
        blockToSlot[blockNumber] = slot;
        blockToSlot[slot] = blockNumber;
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconProofs } from "./BeaconProofs.sol";
import { BeaconRoots } from "./BeaconRoots.sol";

contract BeaconOracle {
    /// @notice Maps a block number to slot
    mapping(uint64 => uint64) public blockToSlot;

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

        // Store mapping
        blockToSlot[blockNumber] = slot;
    }
}

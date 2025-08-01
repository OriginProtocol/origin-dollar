// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IBeaconOracle {
    function blockToSlot(uint64 blockNumber) external returns (uint64 slot);

    function slotToBlock(uint64 slot) external returns (uint64 blockNumber);

    function slotToRoot(uint64 slot) external returns (bytes32 blockRoot);
}

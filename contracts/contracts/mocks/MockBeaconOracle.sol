// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconOracle } from "../beacon/BeaconOracle.sol";

contract MockBeaconOracle is BeaconOracle {
    function mapSlot(
        uint64 blockNumber,
        uint64 slot,
        bytes32 _blockRoot
    ) external {
        _blockToSlot[blockNumber] = slot;
        _slotToBlock[slot] = blockNumber;
        _slotToRoot[slot] = _blockRoot;
    }
}

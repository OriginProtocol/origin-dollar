// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconRoots } from "../beacon/BeaconRoots.sol";

contract MockBeaconRoots {
    function parentBlockRoot(uint64 timestamp)
        external
        view
        returns (bytes32 parentRoot)
    {
        return BeaconRoots.parentBlockRoot(timestamp);
    }

    function latestBlockRoot()
        external
        view
        returns (bytes32 parentRoot, uint64 timestamp)
    {
        timestamp = uint64(block.timestamp);
        parentRoot = BeaconRoots.parentBlockRoot(timestamp);
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconRoots } from "../beacon/BeaconRoots.sol";

contract MockBeaconRoots {
    // Mapping to simulate the ring buffer: timestamp => beacon block root
    mapping(uint256 => bytes32) internal _beaconRoots;

    // Event to log when a new root is set (for testing)
    event RootSet(uint256 indexed timestamp, bytes32 root);

    // Fallback function to handle raw 32-byte timestamp input
    // solhint-disable no-complex-fallback
    fallback() external {
        // Ensure input is exactly 32 bytes (big-endian encoded timestamp)
        require(msg.data.length == 32, "Input must be 32 bytes");

        // Decode the 32-byte input as a uint256 timestamp (big-endian)
        uint256 timestamp = abi.decode(msg.data, (uint256));

        // Don't do any validation of timestamp so we can test any block

        // Retrieve the root. Will return bytes32(0) if not set.
        bytes32 root = _beaconRoots[timestamp];

        // Return the 32-byte root directly
        // solhint-disable-next-line no-inline-assembly
        assembly {
            mstore(0, root)
            return(0, 32)
        }
    }

    // Mock function to set a beacon block root (for testing)
    function setBeaconRoot(uint256 timestamp, bytes32 root) external {
        require(timestamp > 0, "Invalid timestamp");
        require(root != bytes32(0), "Invalid root");

        // Store the root at the given timestamp
        _beaconRoots[timestamp] = root;

        emit RootSet(timestamp, root);
    }

    function parentBlockRoot(
        uint64 timestamp
    ) external view returns (bytes32 parentRoot) {
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

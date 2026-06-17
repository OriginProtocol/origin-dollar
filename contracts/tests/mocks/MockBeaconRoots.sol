// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/// @title Mock Beacon Roots Oracle (EIP-4788)
/// @dev Deployed at 0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02 using vm.etch
/// Returns a stored parent beacon block root for a given timestamp.
contract MockBeaconRoots {
    mapping(uint256 => bytes32) public roots;

    function setBeaconRoot(uint256 timestamp, bytes32 root) external {
        roots[timestamp] = root;
    }

    /// @dev The real contract has no function selector - it's called with raw calldata.
    /// Called via staticcall from BeaconRoots library, so cannot write storage.
    /// Returns stored root if set, otherwise a deterministic hash.
    fallback() external payable {
        uint256 timestamp = abi.decode(msg.data, (uint256));
        bytes32 root = roots[timestamp];
        if (root == bytes32(0)) {
            // Return deterministic root for any timestamp (no storage write)
            root = keccak256(abi.encodePacked("beaconRoot", timestamp));
        }
        bytes memory result = abi.encode(root);
        assembly {
            return(add(result, 32), mload(result))
        }
    }

    receive() external payable {}
}

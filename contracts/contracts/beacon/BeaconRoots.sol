// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

library BeaconRoots {
    /// @notice The address of beacon block roots oracle
    /// See https://eips.ethereum.org/EIPS/eip-4788
    address internal constant BEACON_ROOTS_ADDRESS =
        0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02;

    /// @notice Returns the Beacon Block Root for the previous block.
    /// This comes from the Beacon Roots contract defined in EIP-4788.
    /// This will revert if the block is more than 8,191 blocks old as
    /// that is the size of the beacon root's ring buffer.
    /// @param timestamp The timestamp of the block for which to get the parent root.
    /// @return parentRoot The parent block root for the given timestamp.
    function parentBlockRoot(uint64 timestamp)
        internal
        view
        returns (bytes32 parentRoot)
    {
        // Call the Beacon Block Root Oracle to get the parent block root
        // This does not have a function signature, so we use a staticcall.
        (bool success, bytes memory result) = BEACON_ROOTS_ADDRESS.staticcall(
            abi.encode(timestamp)
        );

        require(success && result.length > 0, "Invalid beacon timestamp");
        parentRoot = abi.decode(result, (bytes32));
    }
}

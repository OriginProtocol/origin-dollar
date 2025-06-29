// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

library BeaconRoots {
    /// @notice The address of beacon block roots oracle
    /// See https://eips.ethereum.org/EIPS/eip-4788
    address internal constant BEACON_ROOTS_ADDRESS =
        0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02;

    /// @notice The length of the beacon block root ring buffer
    uint256 internal constant BEACON_ROOTS_HISTORY_BUFFER_LENGTH = 8191;

    function parentBlockRoot(uint64 timestamp)
        internal
        view
        returns (bytes32 parentRoot)
    {
        require(
            uint256(timestamp) < block.timestamp,
            "Timestamp not in the past"
        );
        require(
            block.timestamp - timestamp <
                BEACON_ROOTS_HISTORY_BUFFER_LENGTH * 12,
            "Timestamp out of range"
        );

        // Call the Beacon Block Root Oracle to get the parent block root
        // This does not have a function signature, so we use a staticcall
        (bool success, bytes memory result) = BEACON_ROOTS_ADDRESS.staticcall(
            abi.encode(timestamp)
        );

        require(success && result.length > 0, "Invalid beacon timestamp");
        parentRoot = abi.decode(result, (bytes32));
    }
}

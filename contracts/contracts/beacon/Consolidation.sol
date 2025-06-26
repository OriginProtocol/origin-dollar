// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

library Consolidation {
    /// @notice The address the consolidation request are sent
    /// See https://eips.ethereum.org/EIPS/eip-7251
    address internal constant CONSOLIDATION_REQUEST_ADDRESS =
        0x0000BBdDc7CE488642fb579F8B00f3a590007251;

    function request(bytes calldata source, bytes calldata target) internal {
        // Get fee from the consolidation request contract
        (bool success, bytes memory result) = CONSOLIDATION_REQUEST_ADDRESS
            .staticcall("");

        require(success && result.length > 0, "failed to get fee");
        uint256 fee = abi.decode(result, (uint256));

        // Call the Consolidation Request contract with the public keys of the source and target
        // validators packed together.
        // This does not have a function signature, so we use a call
        (success, ) = CONSOLIDATION_REQUEST_ADDRESS.call{ value: fee }(
            abi.encodePacked(source, target)
        );

        require(success, "consolidation failed");
    }
}

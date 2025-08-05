// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Library to request validator consolidation on the beacon chain.
 * @author Origin Protocol Inc
 */
library BeaconConsolidation {
    /// @notice The address the validator consolidation requests are sent
    /// See https://eips.ethereum.org/EIPS/eip-7251
    address internal constant CONSOLIDATION_REQUEST_ADDRESS =
        0x0000BBdDc7CE488642fb579F8B00f3a590007251;

    function request(bytes calldata source, bytes calldata target)
        internal
        returns (uint256 fee_)
    {
        require(source.length == 48, "Invalid source byte length");
        require(target.length == 48, "Invalid target byte length");

        fee_ = fee();

        // Call the Consolidation Request contract with the public keys of the source and target
        // validators packed together.
        // This does not have a function signature, so we use a call
        (bool success, ) = CONSOLIDATION_REQUEST_ADDRESS.call{ value: fee_ }(
            abi.encodePacked(source, target)
        );

        require(success, "Consolidation request failed");
    }

    function fee() internal view returns (uint256) {
        // Get fee from the consolidation request contract
        (bool success, bytes memory result) = CONSOLIDATION_REQUEST_ADDRESS
            .staticcall("");

        require(success && result.length > 0, "Failed to get fee");
        return abi.decode(result, (uint256));
    }
}

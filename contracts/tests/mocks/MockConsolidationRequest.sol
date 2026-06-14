// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/// @title Mock Consolidation Request Contract (EIP-7251)
/// @dev Deployed at 0x0000BBdDc7CE488642fb579F8B00f3a590007251 using vm.etch
/// Handles validator consolidation requests from the execution layer.
/// The real contract uses raw calldata (no function selectors).
/// - Empty calldata (staticcall): returns fee (1 wei)
/// - Non-empty calldata (call with value): accepts consolidation request
contract MockConsolidationRequest {
    /// @dev Handle all calls including empty calldata for fee queries.
    /// Cannot use receive() because staticcall needs to return data.
    fallback() external payable {
        if (msg.data.length == 0) {
            // fee() query - return 1 wei as uint256
            bytes memory result = abi.encode(uint256(1));
            assembly {
                return(add(result, 32), mload(result))
            }
        }
        // Otherwise accept the consolidation request (no-op)
    }
}

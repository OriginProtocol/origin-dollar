// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/// @title Mock Withdrawal Request Contract (EIP-7002)
/// @dev Deployed at 0x00000961Ef480Eb55e80D19ad83579A64c007002 using vm.etch
/// Handles validator withdrawal requests from the execution layer.
/// The real contract uses raw calldata (no function selectors).
/// - Empty calldata (staticcall): returns fee (1 wei)
/// - Non-empty calldata (call with value): accepts withdrawal request
contract MockWithdrawalRequest {
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
        // Otherwise accept the withdrawal request (no-op)
    }
}

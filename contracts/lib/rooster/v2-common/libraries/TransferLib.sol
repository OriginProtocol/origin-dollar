// SPDX-License-Identifier: GPL-2.0-or-later
// As the copyright holder of this work, Ubiquity Labs retains
// the right to distribute, use, and modify this code under any license of
// their choosing, in addition to the terms of the GPL-v2 or later.
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Low-gas transfer functions.
 */
library TransferLib {
    error TransferFailed(IERC20 token, address to, uint256 amount);
    error TransferFromFailed(IERC20 token, address from, address to, uint256 amount);

    // implementation adapted from
    // https://github.com/transmissions11/solmate/blob/e8f96f25d48fe702117ce76c79228ca4f20206cb/src/utils/SafeTransferLib.sol

    /**
     * @notice Transfer token amount.  Amount is sent from caller address to `to` address.
     */
    function transfer(IERC20 token, address to, uint256 amount) internal {
        bool success;
        assembly ("memory-safe") {
            // We'll write our calldata to this slot below, but restore it later.
            let memPointer := mload(0x40)

            // Write the abi-encoded calldata into memory, beginning with the function selector.
            mstore(memPointer, 0xa9059cbb00000000000000000000000000000000000000000000000000000000)
            // Append arguments. Addresses are assumed clean. Transfer will fail otherwise.
            mstore(add(memPointer, 0x4), to)
            mstore(add(memPointer, 0x24), amount) // Append the "amount" argument.
            // 68 bytes total

            // fail if reverted; only allocate 32 bytes for return to ensure we
            // only use mem slot 0 which is scatch space and memory safe to use.
            success := call(gas(), token, 0, memPointer, 68, 0, 32)
            // handle transfers that return 1/true and ensure the value is from
            // the return and not dirty bits left in the scratch space.
            let returnedOne := and(eq(mload(0), 1), gt(returndatasize(), 31))
            // handle transfers that return nothing
            let noReturn := iszero(returndatasize())
            // good if didn't revert and the return is either empty or true
            success := and(success, or(returnedOne, noReturn))
        }

        if (!success) revert TransferFailed(token, to, amount);
    }

    /**
     * @notice Transfer token amount.  Amount is sent from `from` address to `to` address.
     */
    function transferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        bool success;

        assembly ("memory-safe") {
            // We'll write our calldata to this slot below, but restore it later.
            let memPointer := mload(0x40)

            // Write the abi-encoded calldata into memory, beginning with the function selector.
            mstore(memPointer, 0x23b872dd00000000000000000000000000000000000000000000000000000000)
            // Append arguments. Addresses are assumed clean. Transfer will fail otherwise.
            mstore(add(memPointer, 0x4), from) // Append the "from" argument.
            mstore(add(memPointer, 0x24), to) // Append the "to" argument.
            mstore(add(memPointer, 0x44), amount) // Append the "amount" argument.
            // 100 bytes total

            // fail if reverted; only allocate 32 bytes for return to ensure we
            // only use mem slot 0 which is scatch space and memory safe to use.
            success := call(gas(), token, 0, memPointer, 100, 0, 32)
            // handle transfers that return 1/true and ensure the value is from
            // the return and not dirty bits left in the scratch space.
            let returnedOne := and(eq(mload(0), 1), gt(returndatasize(), 31))
            // handle transfers that return nothing
            let noReturn := iszero(returndatasize())
            // good if didn't revert and the return is either empty or true
            success := and(success, or(returnedOne, noReturn))
        }

        if (!success) revert TransferFromFailed(token, from, to, amount);
    }
}
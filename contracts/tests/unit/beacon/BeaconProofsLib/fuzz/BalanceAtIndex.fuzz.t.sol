// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";
import {Endian} from "contracts/beacon/Endian.sol";

contract Unit_Fuzz_BeaconProofsLib_BalanceAtIndex_Test is Unit_BeaconProofsLib_Shared_Test {
    /// @dev Pack 4 LE uint64 balances into a bytes32 leaf and verify extraction
    function testFuzz_balanceAtIndex_packAndExtract(uint64 b0, uint64 b1, uint64 b2, uint64 b3) public view {
        // Build the leaf: 4 little-endian uint64 values packed into bytes32
        // Position 0 (index % 4 == 0): most significant 8 bytes
        // Position 1 (index % 4 == 1): next 8 bytes
        // Position 2 (index % 4 == 2): next 8 bytes
        // Position 3 (index % 4 == 3): least significant 8 bytes
        bytes32 leaf = bytes32(
            (uint256(_reverseBytes64(b0)) << 192) | (uint256(_reverseBytes64(b1)) << 128)
                | (uint256(_reverseBytes64(b2)) << 64) | uint256(_reverseBytes64(b3))
        );

        assertEq(beaconProofs.balanceAtIndex(leaf, 0), b0);
        assertEq(beaconProofs.balanceAtIndex(leaf, 1), b1);
        assertEq(beaconProofs.balanceAtIndex(leaf, 2), b2);
        assertEq(beaconProofs.balanceAtIndex(leaf, 3), b3);
    }

    /// @dev Verify that balanceAtIndex uses modulo 4
    function testFuzz_balanceAtIndex_moduloWrapping(uint64 balance, uint40 validatorIndex) public view {
        uint256 slot = uint256(validatorIndex) % 4;
        uint256 shift = (3 - slot) * 64; // Reverse: slot 0 at top, slot 3 at bottom
        bytes32 leaf = bytes32(uint256(_reverseBytes64(balance)) << shift);

        // Also put zeros everywhere else — leaf only has data at one slot
        assertEq(beaconProofs.balanceAtIndex(leaf, validatorIndex), balance);
    }

    function _reverseBytes64(uint64 v) internal pure returns (uint64) {
        return (v >> 56) | ((0x00FF000000000000 & v) >> 40) | ((0x0000FF0000000000 & v) >> 24)
            | ((0x000000FF00000000 & v) >> 8) | ((0x00000000FF000000 & v) << 8) | ((0x0000000000FF0000 & v) << 24)
            | ((0x000000000000FF00 & v) << 40) | ((0x00000000000000FF & v) << 56);
    }
}

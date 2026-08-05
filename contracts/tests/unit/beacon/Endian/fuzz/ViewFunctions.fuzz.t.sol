// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Endian_Shared_Test} from "tests/unit/beacon/Endian/shared/Shared.t.sol";

contract Unit_Fuzz_Endian_ViewFunctions_Test is Unit_Endian_Shared_Test {
    /// @dev from(to(x)) == x for any uint64
    function testFuzz_roundtrip_fromTo(uint64 value) public view {
        bytes32 le = endianWrapper.toLittleEndianUint64(value);
        uint64 result = endianWrapper.fromLittleEndianUint64(le);
        assertEq(result, value);
    }

    /// @dev to(from(le)) == le when le has data only in top 8 bytes
    function testFuzz_roundtrip_toFrom(uint64 leRaw) public view {
        // Construct a valid LE bytes32 with data only in the top 8 bytes
        bytes32 le = bytes32(uint256(leRaw) << 192);
        uint64 be = endianWrapper.fromLittleEndianUint64(le);
        bytes32 result = endianWrapper.toLittleEndianUint64(be);
        assertEq(result, le);
    }

    /// @dev toLittleEndianUint64 always places data in top 8 bytes only
    function testFuzz_toLittleEndianUint64_topBitsOnly(uint64 value) public view {
        bytes32 le = endianWrapper.toLittleEndianUint64(value);
        // Lower 24 bytes should be zero
        assertEq(uint256(le) & ((1 << 192) - 1), 0);
    }
}

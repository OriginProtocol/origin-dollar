// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Endian_Shared_Test} from "tests/unit/beacon/Endian/shared/Shared.t.sol";

contract Unit_Concrete_Endian_ViewFunctions_Test is Unit_Endian_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- fromLittleEndianUint64
    //////////////////////////////////////////////////////

    function test_fromLittleEndianUint64_zero() public view {
        // Zero in LE is still zero
        assertEq(endianWrapper.fromLittleEndianUint64(bytes32(0)), 0);
    }

    function test_fromLittleEndianUint64_one() public view {
        // 1 in LE uint64 stored in top 8 bytes of bytes32:
        // 0x0100000000000000 in top 8 bytes
        bytes32 le = bytes32(uint256(0x0100000000000000) << 192);
        assertEq(endianWrapper.fromLittleEndianUint64(le), 1);
    }

    function test_fromLittleEndianUint64_maxUint64() public view {
        // max uint64 = 0xFFFFFFFFFFFFFFFF, LE representation is same bytes reversed
        // but since all bytes are 0xFF, LE == BE
        bytes32 le = bytes32(uint256(0xFFFFFFFFFFFFFFFF) << 192);
        assertEq(endianWrapper.fromLittleEndianUint64(le), type(uint64).max);
    }

    function test_fromLittleEndianUint64_knownValue() public view {
        // Value 0x0102030405060708 in LE is stored as 0x0807060504030201
        bytes32 le = bytes32(uint256(0x0807060504030201) << 192);
        assertEq(endianWrapper.fromLittleEndianUint64(le), 0x0102030405060708);
    }

    //////////////////////////////////////////////////////
    /// --- toLittleEndianUint64
    //////////////////////////////////////////////////////

    function test_toLittleEndianUint64_zero() public view {
        assertEq(endianWrapper.toLittleEndianUint64(0), bytes32(0));
    }

    function test_toLittleEndianUint64_one() public view {
        // 1 in BE → 0x0100000000000000 in LE, stored in top 8 bytes
        bytes32 expected = bytes32(uint256(0x0100000000000000) << 192);
        assertEq(endianWrapper.toLittleEndianUint64(1), expected);
    }

    function test_toLittleEndianUint64_maxUint64() public view {
        // All 0xFF bytes remain the same when reversed
        bytes32 expected = bytes32(uint256(0xFFFFFFFFFFFFFFFF) << 192);
        assertEq(endianWrapper.toLittleEndianUint64(type(uint64).max), expected);
    }

    function test_toLittleEndianUint64_knownValue() public view {
        // BE 0x0102030405060708 → LE 0x0807060504030201
        bytes32 expected = bytes32(uint256(0x0807060504030201) << 192);
        assertEq(endianWrapper.toLittleEndianUint64(0x0102030405060708), expected);
    }

    //////////////////////////////////////////////////////
    /// --- Roundtrips
    //////////////////////////////////////////////////////

    function test_roundtrip_fromToLittleEndian() public view {
        uint64 value = 32_000_000_000; // 32 ETH in Gwei
        bytes32 le = endianWrapper.toLittleEndianUint64(value);
        uint64 result = endianWrapper.fromLittleEndianUint64(le);
        assertEq(result, value);
    }

    function test_roundtrip_toFromLittleEndian() public view {
        // Start with LE bytes: 0x0807060504030201 in top 8 bytes
        bytes32 le = bytes32(uint256(0x0807060504030201) << 192);
        uint64 be = endianWrapper.fromLittleEndianUint64(le);
        bytes32 result = endianWrapper.toLittleEndianUint64(be);
        assertEq(result, le);
    }
}

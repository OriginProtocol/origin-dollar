// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";
import {Endian} from "contracts/beacon/Endian.sol";

contract Unit_Concrete_BeaconProofsLib_ViewFunctions_Test is Unit_BeaconProofsLib_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- concatGenIndices
    //////////////////////////////////////////////////////

    function test_concatGenIndices_validators() public view {
        // VALIDATORS_CONTAINER_GENERALIZED_INDEX = 715
        // (2^3 + 3) * 2^6 + 11 = 715
        uint256 result = beaconProofs.concatGenIndices(1, 9, 715);
        // (1 << 9) | 715 = 512 | 715 = 715 (since 1 << 9 = 512, and 715 > 512)
        // Actually concatGenIndices(1, 9, 715) = (1 << 9) | 715 = 512 + 203 = 715
        // Wait: genIndex=1, height=9, index=715 => (1 << 9) | 715 = 512 | 715
        // 512 = 0b1000000000, 715 = 0b1011001011
        // That's not how the constants are derived. Let me just test known values.

        // Test: concatGenIndices(715, 41, 0) = 715 << 41 = 715 * 2^41
        uint256 result2 = beaconProofs.concatGenIndices(715, 41, 0);
        assertEq(result2, uint256(715) << 41);
    }

    function test_concatGenIndices_validatorsIndex() public view {
        // For validator index 100: concatGenIndices(715, 41, 100)
        uint256 result = beaconProofs.concatGenIndices(715, 41, 100);
        assertEq(result, (uint256(715) << 41) | 100);
    }

    function test_concatGenIndices_balances() public view {
        // BALANCES_CONTAINER_GENERALIZED_INDEX = 716
        uint256 result = beaconProofs.concatGenIndices(716, 39, 0);
        assertEq(result, uint256(716) << 39);
    }

    function test_concatGenIndices_firstPendingDeposit() public view {
        // FIRST_PENDING_DEPOSIT_GENERALIZED_INDEX = 198105366528
        // = ((2^3 + 3) * 2^6 + 34) * 2^28 + 0
        // = 738 * 2^28
        uint256 result = beaconProofs.concatGenIndices(738, 28, 0);
        assertEq(result, 198105366528);
    }

    function test_concatGenIndices_identity() public view {
        // genIndex=1, height=0, index=0 → 1
        assertEq(beaconProofs.concatGenIndices(1, 0, 0), 1);
    }

    function test_concatGenIndices_formula() public view {
        // (genIndex << height) | index
        assertEq(beaconProofs.concatGenIndices(5, 3, 2), (5 << 3) | 2);
        assertEq(beaconProofs.concatGenIndices(10, 10, 500), (10 << 10) | 500);
    }

    //////////////////////////////////////////////////////
    /// --- balanceAtIndex
    //////////////////////////////////////////////////////

    function test_balanceAtIndex_index0() public view {
        // Pack 4 LE uint64 values into a bytes32
        // Index 0 is the most-significant 8 bytes
        // 32 ETH = 32_000_000_000 Gwei
        uint64 balance = 32_000_000_000;
        bytes32 leaf = Endian.toLittleEndianUint64(balance);
        // toLittleEndianUint64 puts the LE bytes in the top 8 bytes — perfect for index 0

        uint256 result = beaconProofs.balanceAtIndex(leaf, 0);
        assertEq(result, balance);
    }

    function test_balanceAtIndex_index1() public view {
        // Index 1: bytes 8-15 (second 8-byte slot)
        uint64 balance = 16_000_000_000; // 16 ETH
        // The balance at index 1 sits at bit offset 64 from the left
        // balanceAtIndex shifts left by (validatorIndex % 4) * 64 = 64 bits
        // So we need our LE data at byte position 8-15
        bytes32 leaf = bytes32(uint256(_reverseBytes64(balance)) << 128);

        uint256 result = beaconProofs.balanceAtIndex(leaf, 1);
        assertEq(result, balance);
    }

    function test_balanceAtIndex_index2() public view {
        uint64 balance = 64_000_000_000; // 64 ETH
        bytes32 leaf = bytes32(uint256(_reverseBytes64(balance)) << 64);

        uint256 result = beaconProofs.balanceAtIndex(leaf, 2);
        assertEq(result, balance);
    }

    function test_balanceAtIndex_index3() public view {
        uint64 balance = 1_000_000_000; // 1 ETH
        bytes32 leaf = bytes32(uint256(_reverseBytes64(balance)));

        uint256 result = beaconProofs.balanceAtIndex(leaf, 3);
        assertEq(result, balance);
    }

    function test_balanceAtIndex_zeros() public view {
        assertEq(beaconProofs.balanceAtIndex(bytes32(0), 0), 0);
        assertEq(beaconProofs.balanceAtIndex(bytes32(0), 1), 0);
        assertEq(beaconProofs.balanceAtIndex(bytes32(0), 2), 0);
        assertEq(beaconProofs.balanceAtIndex(bytes32(0), 3), 0);
    }

    function test_balanceAtIndex_maxBalance() public view {
        // Max uint64 at index 0
        bytes32 leaf = bytes32(uint256(type(uint64).max) << 192);
        uint256 result = beaconProofs.balanceAtIndex(leaf, 0);
        assertEq(result, type(uint64).max);
    }

    function test_balanceAtIndex_moduloWrapping() public view {
        // validatorIndex=4 should behave like index=0 (4 % 4 == 0)
        uint64 balance = 32_000_000_000;
        bytes32 leaf = Endian.toLittleEndianUint64(balance);

        uint256 result = beaconProofs.balanceAtIndex(leaf, 4);
        assertEq(result, balance);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _reverseBytes64(uint64 v) internal pure returns (uint64) {
        return (v >> 56) | ((0x00FF000000000000 & v) >> 40) | ((0x0000FF0000000000 & v) >> 24)
            | ((0x000000FF00000000 & v) >> 8) | ((0x00000000FF000000 & v) << 8)
            | ((0x0000000000FF0000 & v) << 24) | ((0x000000000000FF00 & v) << 40)
            | ((0x00000000000000FF & v) << 56);
    }
}

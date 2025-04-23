// SPDX-License-Identifier: GPL-2.0-or-later
// As the copyright holder of this work, Ubiquity Labs retains
// the right to distribute, use, and modify this code under any license of
// their choosing, in addition to the terms of the GPL-v2 or later.
pragma solidity ^0.8.25;

library ArrayOperations {
    error ArrayElementsNotUnique(uint256 index, uint256 duplicateEntry);

    /**
     * @notice Checks that array of numbers are unique.
     * @param array Array of numbers to check.
     * @param maxArrayElementValue Maximum value possible in Array.
     */
    function checkUnique(uint32[] memory array, uint256 maxArrayElementValue) internal pure {
        // for pool with few bins (less than ~100k), the bitmap approach is
        // more gas efficient than exhaustive search of a 10-bin list.  As the
        // bin count in a pool grows beyond this, the gas cost of the bitmap
        // memory allocation quickly overtakes the exhaustive search cost.
        if (maxArrayElementValue < 100_000) {
            // allocate bitmap and set indexes to check uniqueness
            checkUniqueViaBitMap(array, maxArrayElementValue);
        } else {
            // search to check uniqueness
            checkUniqueViaSearch(array);
        }
    }

    /**
     * @notice Search all pair-wise combinations; low memory, but quadratic
     * comparison cost.
     */
    function checkUniqueViaSearch(uint32[] memory array) internal pure {
        uint256 length = array.length;
        if (length <= 1) return;
        for (uint256 i = 0; i < length - 1; i++) {
            for (uint256 j = i + 1; j < length; j++) {
                if (array[i] == array[j]) revert ArrayElementsNotUnique(j, array[j]);
            }
        }
    }

    /**
     * @notice Fill bitmap with values and revert on collision; memory is
     * proportional to pool bin count while comparison costs are linear in
     * array length.
     */
    function checkUniqueViaBitMap(uint32[] memory array, uint256 maxArrayElementValue) internal pure {
        uint256 length = array.length;
        if (length <= 1) return;
        uint256[] memory bitMap = new uint256[]((maxArrayElementValue >> 8) + 1);
        for (uint256 i; i < length; i++) {
            if (get(bitMap, array[i])) revert ArrayElementsNotUnique(i, array[i]);
            set(bitMap, array[i]);
        }
    }

    /**
     * @notice Gets the bit at `index`.
     */
    function get(uint256[] memory bitmap, uint256 index) private pure returns (bool) {
        uint256 bucket = index >> 8;
        uint256 mask = 1 << (index & 0xff);
        return bitmap[bucket] & mask != 0;
    }

    /**
     * @notice Sets the bit at `index`.
     */
    function set(uint256[] memory bitmap, uint256 index) private pure {
        uint256 bucket = index >> 8;
        uint256 mask = 1 << (index & 0xff);
        bitmap[bucket] |= mask;
    }
}
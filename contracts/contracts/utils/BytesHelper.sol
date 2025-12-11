// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

library BytesHelper {
    /**
     * @dev Extract a slice from bytes memory
     * @param data The bytes memory to slice
     * @param start The start index (inclusive)
     * @param end The end index (exclusive)
     * @return result A new bytes memory containing the slice
     */
    function extractSlice(
        bytes memory data,
        uint256 start,
        uint256 end
    ) private pure returns (bytes memory) {
        require(end >= start, "Invalid slice range");
        require(end <= data.length, "Slice end exceeds data length");

        uint256 length = end - start;
        bytes memory result = new bytes(length);

        // Simple byte-by-byte copy
        for (uint256 i = 0; i < length; i++) {
            result[i] = data[start + i];
        }

        return result;
    }
}

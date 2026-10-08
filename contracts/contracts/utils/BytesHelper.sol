// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

uint256 constant UINT32_LENGTH = 4;
uint256 constant UINT64_LENGTH = 8;
uint256 constant UINT256_LENGTH = 32;
// Address is 20 bytes, but we expect the data to be padded with 0s to 32 bytes
uint256 constant ADDRESS_LENGTH = 32;

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
    ) internal pure returns (bytes memory) {
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

    /**
     * @dev Decode a uint32 from a bytes memory
     * @param data The bytes memory to decode
     * @return uint32 The decoded uint32
     */
    function decodeUint32(bytes memory data) internal pure returns (uint32) {
        require(data.length == 4, "Invalid data length");
        return uint32(uint256(bytes32(data)) >> 224);
    }

    /**
     * @dev Extract a uint32 from a bytes memory
     * @param data The bytes memory to extract from
     * @param start The start index (inclusive)
     * @return uint32 The extracted uint32
     */
    function extractUint32(bytes memory data, uint256 start)
        internal
        pure
        returns (uint32)
    {
        return decodeUint32(extractSlice(data, start, start + UINT32_LENGTH));
    }

    /**
     * @dev Decode an address from a bytes memory.
     *      Expects the data to be padded with 0s to 32 bytes.
     * @param data The bytes memory to decode
     * @return address The decoded address
     */
    function decodeAddress(bytes memory data) internal pure returns (address) {
        // We expect the data to be padded with 0s, so length is 32 not 20
        require(data.length == 32, "Invalid data length");
        return abi.decode(data, (address));
    }

    /**
     * @dev Extract an address from a bytes memory
     * @param data The bytes memory to extract from
     * @param start The start index (inclusive)
     * @return address The extracted address
     */
    function extractAddress(bytes memory data, uint256 start)
        internal
        pure
        returns (address)
    {
        return decodeAddress(extractSlice(data, start, start + ADDRESS_LENGTH));
    }

    /**
     * @dev Decode a uint256 from a bytes memory
     * @param data The bytes memory to decode
     * @return uint256 The decoded uint256
     */
    function decodeUint256(bytes memory data) internal pure returns (uint256) {
        require(data.length == 32, "Invalid data length");
        return abi.decode(data, (uint256));
    }

    /**
     * @dev Extract a uint256 from a bytes memory
     * @param data The bytes memory to extract from
     * @param start The start index (inclusive)
     * @return uint256 The extracted uint256
     */
    function extractUint256(bytes memory data, uint256 start)
        internal
        pure
        returns (uint256)
    {
        return decodeUint256(extractSlice(data, start, start + UINT256_LENGTH));
    }
}

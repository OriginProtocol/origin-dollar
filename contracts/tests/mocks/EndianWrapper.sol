// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Endian} from "contracts/beacon/Endian.sol";

contract EndianWrapper {
    function fromLittleEndianUint64(bytes32 lenum) external pure returns (uint64) {
        return Endian.fromLittleEndianUint64(lenum);
    }

    function toLittleEndianUint64(uint64 benum) external pure returns (bytes32) {
        return Endian.toLittleEndianUint64(benum);
    }
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

contract MockSafeContract {
    function execTransactionFromModule(address target, uint256 value, bytes memory data, uint8 operation) external returns (bool) {
        (bool success, ) = target.call{ value: value }(data);
        return success;
    }
}

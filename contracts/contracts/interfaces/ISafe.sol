// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ISafe {
    function execTransactionFromModule(
        address,
        uint256,
        bytes memory,
        uint8
    ) external returns (bool);
}

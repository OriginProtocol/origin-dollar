// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {ISafe} from "contracts/interfaces/ISafe.sol";

/// @title MockSafeContract
/// @notice A minimal mock of Gnosis Safe that executes module transactions directly.
///         When `execTransactionFromModule` is called, it performs a low-level call
///         on behalf of the Safe, simulating the real Safe behavior.
contract MockSafeContract is ISafe {
    bool public shouldFail;

    function setShouldFail(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        uint8 /* operation */
    )
        external
        override
        returns (bool)
    {
        if (shouldFail) return false;

        (bool success,) = to.call{value: value}(data);
        return success;
    }

    receive() external payable {}
}

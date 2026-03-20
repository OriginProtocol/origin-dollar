// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/// @title MockCurveMinter
/// @notice Minimal mock for Curve minter.
contract MockCurveMinter {
    function mint(address /* gauge */ ) external {
        // no-op
    }
}

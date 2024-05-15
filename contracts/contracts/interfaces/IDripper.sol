// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDripper {
    /// @notice How much funds have dripped out already and are currently
    //   available to be sent to the vault.
    /// @return The amount that would be sent if a collect was called
    function availableFunds() external view returns (uint256);

    /// @notice Collect all dripped funds and send to vault.
    ///  Recalculate new drip rate.
    function collect() external;

    /// @notice Collect all dripped funds, send to vault, recalculate new drip
    ///  rate, and rebase mToken.
    function collectAndRebase() external;
}

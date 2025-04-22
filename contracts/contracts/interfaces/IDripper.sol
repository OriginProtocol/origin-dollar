// SPDX-License-Identifier: BUSL-1.1
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

    /// @notice Change the drip duration. Governor only.
    /// @param _durationSeconds the number of seconds to drip out the entire
    ///  balance over if no collects were called during that time.
    function setDripDuration(uint256 _durationSeconds) external;

    /// @dev Transfer out ERC20 tokens held by the contract. Governor only.
    /// @param _asset ERC20 token address
    /// @param _amount amount to transfer
    function transferToken(address _asset, uint256 _amount) external;
}

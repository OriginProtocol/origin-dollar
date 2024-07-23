// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IVoter {
    /// @notice Create a new gauge (unpermissioned).
    /// @dev Governor can create a new gauge for a pool with any address.
    /// @param _poolFactory .
    /// @param _pool .
    function createGauge(address _poolFactory, address _pool)
        external
        returns (address);

    /// @dev Pool => Gauge
    function gauges(address pool) external view returns (address);
}

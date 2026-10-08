// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IVoterV3 {
    /// @notice create a gauge
    function createGauge(address _pool, uint256 _gaugeType)
        external
        returns (
            address _gauge,
            address _internal_bribe,
            address _external_bribe
        );

    function gauges(address _pool) external view returns (address _gauge);
}

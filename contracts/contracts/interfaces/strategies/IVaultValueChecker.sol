// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IVaultValueChecker {
    function vault() external view returns (address);

    function ousd() external view returns (address);

    function snapshots(address user)
        external
        view
        returns (
            uint256 vaultValue,
            uint256 totalSupply,
            uint256 time
        );

    function takeSnapshot() external;

    function checkDelta(
        int256 expectedProfit,
        int256 profitVariance,
        int256 expectedVaultChange,
        int256 vaultChangeVariance
    ) external;
}

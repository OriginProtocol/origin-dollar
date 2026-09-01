// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IBridgedWOETHMigrationStrategy {
    // Events
    event WOETHBridgedToRemote(uint256 amount, uint256 totalBridged);
    event MaxPerBridgeSet(uint256 maxPerBridge);

    // Migration
    function bridgeToRemote(uint256 amount) external payable;

    function setMaxPerBridge(uint256 maxPerBridge) external;

    // Views (migration)
    function master() external view returns (address);

    function ccipChainSelectorMainnet() external view returns (uint64);

    function totalBridged() external view returns (uint256);

    function maxPerBridge() external view returns (uint256);

    // Views (inherited from BridgedWOETHStrategy)
    function checkBalance(address asset) external view returns (uint256);

    function updateWOETHOraclePrice() external returns (uint256);

    function lastOraclePrice() external view returns (uint128);

    function maxPriceDiffBps() external view returns (uint128);

    function weth() external view returns (address);

    function bridgedWOETH() external view returns (address);

    function oethb() external view returns (address);

    function oracle() external view returns (address);

    function vaultAddress() external view returns (address);

    function governor() external view returns (address);
}

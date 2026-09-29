// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/// @dev Inherited by `BridgedWOETHMigrationStrategy`, so it declares only what that contract
///      defines itself. Members from `BridgedWOETHStrategy` / `InitializableAbstractStrategy` /
///      `Governable` (e.g. `weth`, `lastOraclePrice`, `vaultAddress`, `governor`) are public
///      getters or non-virtual functions there and so can't be declared here. `ccipRouter` is
///      omitted because its `IRouterClient`-typed getter can't implement an `address` return.
interface IBridgedWOETHMigrationStrategy {
    // Events
    event WOETHBridgedToRemote(uint256 amount, uint256 totalBridged);
    event MaxPerBridgeSet(uint256 maxPerBridge);

    // Migration
    function bridgeToRemote(uint256 amount) external payable;

    function setMaxPerBridge(uint256 maxPerBridge) external;

    // Views
    function checkBalance(address asset) external view returns (uint256);

    function master() external view returns (address);

    function ccipChainSelectorMainnet() external view returns (uint64);

    function totalBridged() external view returns (uint256);

    function maxPerBridge() external view returns (uint256);
}

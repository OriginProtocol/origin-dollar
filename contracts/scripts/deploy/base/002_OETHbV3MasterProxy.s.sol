// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {CreateXHelper} from "scripts/deploy/helpers/CreateXHelper.sol";

// Contracts
import {CrossChainStrategyProxy} from "contracts/proxies/create2/CrossChainStrategyProxy.sol";

/// @title 002_OETHbV3MasterProxy
/// @notice Deploys the OETHb V3 Master strategy proxy on Base at a CreateX-deterministic address.
/// @dev Deployed on its own, ahead of the implementation, because the address is an input to
///      several later steps: `003` initialises it and wires the adapters, `004` bakes it into
///      `BridgedWOETHMigrationStrategy` as an immutable, and the Ethereum side deploys Remote at
///      the identical address from the same salt (`mainnet/005_OETHbV3RemoteProxy`).
///
///      That last point is the reason for CreateX rather than a plain `new`: the adapters accept
///      an inbound message only when `transportSender == address(this)`, so Master on Base and
///      Remote on Ethereum must share one address.
contract $002_OETHbV3MasterProxy is AbstractDeployScript("002_OETHbV3MasterProxy") {
    /// @notice Salt for the OETHb wOETH V3 strategy pair.
    /// @dev MUST match `mainnet/005_OETHbV3RemoteProxy`. Convention for V3 salts:
    ///        * identical on PAIRED chains — peer parity depends on it;
    ///        * version suffix (`1`, `2`, …) increments only when deploying a fresh pair while
    ///          keeping a previous one live.
    string internal constant SALT = "OETHb wOETH V3 Strategy 1";

    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        address proxy = CreateXHelper.deploy(
            SALT, CreateXHelper.proxyInitCode(type(CrossChainStrategyProxy).creationCode, deployer)
        );
        _recordDeployment("OETHB_V3_MASTER_PROXY", proxy, type(CrossChainStrategyProxy).name);
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        address proxy = resolver.resolve("OETHB_V3_MASTER_PROXY");
        require(proxy.code.length > 0, "Master proxy has no code");

        // Re-derive the address rather than trusting the recorded one: this is what pins the
        // Ethereum-side Remote proxy to the same address, and it holds for the life of the
        // deployment, so it stays a valid check on every later fork run.
        address expected = CreateXHelper.computeAddress(
            SALT, CreateXHelper.proxyInitCode(type(CrossChainStrategyProxy).creationCode, deployer)
        );
        require(proxy == expected, "Master proxy is not at its CreateX address");
    }
}

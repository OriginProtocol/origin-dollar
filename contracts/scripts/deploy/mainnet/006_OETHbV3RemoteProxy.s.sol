// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {CreateXHelper} from "scripts/deploy/helpers/CreateXHelper.sol";

// Contracts
import {CrossChainStrategyProxy} from "contracts/proxies/create2/CrossChainStrategyProxy.sol";

/// @title 006_OETHbV3RemoteProxy
/// @notice Deploys the OETHb V3 Remote strategy proxy on Ethereum at a CreateX-deterministic address.
/// @dev Same salt, same proxy source and same deployer as `base/002_OETHbV3MasterProxy`, which is
///      what puts Remote on Ethereum at the same address as Master on Base. The adapters accept an
///      inbound message only when `transportSender == address(this)`, so that parity is load
///      bearing rather than cosmetic — `_fork` re-derives the address to prove it holds.
contract $006_OETHbV3RemoteProxy is AbstractDeployScript("006_OETHbV3RemoteProxy") {
    /// @notice MUST match `base/002_OETHbV3MasterProxy`.
    string internal constant SALT = "OETHb wOETH V3 Strategy 1";

    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        address proxy = CreateXHelper.deploy(
            SALT, CreateXHelper.proxyInitCode(type(CrossChainStrategyProxy).creationCode, deployer)
        );
        _recordDeployment("OETHB_V3_REMOTE_PROXY", proxy, type(CrossChainStrategyProxy).name);
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        address proxy = resolver.resolve("OETHB_V3_REMOTE_PROXY");
        require(proxy.code.length > 0, "Remote proxy has no code");

        address expected = CreateXHelper.computeAddress(
            SALT, CreateXHelper.proxyInitCode(type(CrossChainStrategyProxy).creationCode, deployer)
        );
        require(proxy == expected, "Remote proxy is not at its CreateX address");
    }
}

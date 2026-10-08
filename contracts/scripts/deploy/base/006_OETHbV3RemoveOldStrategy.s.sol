// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";

// Contracts
import {IVault} from "contracts/interfaces/IVault.sol";

// Addresses
import {Base} from "tests/utils/Addresses.sol";

/// @title 006_OETHbV3RemoveOldStrategy
/// @notice Post-migration cleanup: removes BridgedWOETHStrategy from the OETHb vault.
/// @dev `skip` is true, so this sits in the repo without firing. Flip it to false once every
///      `bridgeToRemote(1000e18)` call has settled on Ethereum — the vault refuses
///      `removeStrategy` while the strategy still reports a balance, and until then a fork run
///      would fail on a migration that has not happened yet.
contract $006_OETHbV3RemoveOldStrategy is AbstractDeployScript("006_OETHbV3RemoveOldStrategy") {
    using GovHelper for GovProposal;

    bool public constant override skip = true;

    // ==================== Governance Proposal ==================== //

    function _buildGovernanceProposal() internal override {
        govProposal.setDescription(
            "Remove the old BridgedWOETHStrategy from the OETHb vault\n\n"
            "The wOETH position has been migrated to the V3 Master/Remote pair, leaving this "
            "strategy at dust. Removing it retires the oracle-priced valuation path."
        );

        govProposal.action(
            Base.OETHBaseVaultProxy, "removeStrategy(address)", abi.encode(Base.BridgedWOETHStrategyProxy)
        );
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        require(
            !IVault(Base.OETHBaseVaultProxy).strategies(Base.BridgedWOETHStrategyProxy).isSupported,
            "Old BridgedWOETH strategy still approved"
        );
    }
}

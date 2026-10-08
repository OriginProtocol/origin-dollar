// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";

// Contracts
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
import {BridgedWOETHMigrationStrategy} from "contracts/strategies/BridgedWOETHMigrationStrategy.sol";
import {InitializeGovernedUpgradeabilityProxy} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";

// Addresses
import {Base, CrossChain, Mainnet} from "tests/utils/Addresses.sol";

/// @title 004_OETHbV3WOETHMigration
/// @notice Upgrades the live BridgedWOETHStrategy on Base to the migration implementation.
/// @dev The Base vault's wOETH sits in `BridgedWOETHStrategy`, valued off an oracle rather than
///      earning reported yield. The migration implementation keeps that contract's V1 behaviour
///      and adds `bridgeToRemote()`, which CCIP-ships the custodied wOETH to Remote on Ethereum in
///      rate-limited batches. Master and Remote share one address under CreateX parity, so the
///      single `master` immutable serves both as the local read target for in-flight
///      reconciliation and as the cross-chain CCIP recipient.
///
///      Storage note: the deploy-time gate keys on the contract NAME, and this contract's name
///      differs from the `BridgedWOETHStrategy` implementation the proxy runs today. So
///      `deployments/base/BridgedWOETHMigrationStrategy.json` is pre-seeded with the live
///      `BridgedWOETHStrategy` storage layout, making the gate compare this implementation
///      against what is actually deployed behind the proxy (instead of passing it as a brand-new
///      contract). The descriptor refresh overwrites the seed after the real deploy. The fork
///      check below complements that with a live read-back of V1 state through the proxy. The
///      migration only appends `totalBridged` and `maxPerBridge`; everything the constructor
///      takes is immutable.
contract $004_OETHbV3WOETHMigration is AbstractDeployScript("004_OETHbV3WOETHMigration") {
    using GovHelper for GovProposal;

    /// @notice Per-call wOETH bridge cap, mirroring the CCIP rate-limit budget.
    uint256 internal constant MAX_PER_BRIDGE = 1000 ether;

    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        BridgedWOETHMigrationStrategy migrationImpl = new BridgedWOETHMigrationStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: CrossChain.zero, vaultAddress: Base.OETHBaseVaultProxy
            }),
            Base.WETH,
            Base.BridgedWOETH,
            Base.OETHBaseProxy,
            Base.OETHBaseOracleRouter,
            resolver.resolve("OETHB_V3_MASTER_PROXY"),
            Base.CCIPRouter,
            Mainnet.CCIPChainSelector
        );
        _recordDeployment(
            "BRIDGED_WOETH_MIGRATION_STRATEGY_IMPL", address(migrationImpl), type(BridgedWOETHMigrationStrategy).name
        );
    }

    // ==================== Governance Proposal ==================== //

    function _buildGovernanceProposal() internal override {
        govProposal.setDescription(
            "Upgrade BridgedWOETHStrategy to BridgedWOETHMigrationStrategy and set the bridge cap\n\n"
            "Adds bridgeToRemote(), which ships the custodied wOETH to the V3 Remote strategy on "
            "Ethereum over CCIP in capped batches, and sets that per-call cap. All V1 behaviour is "
            "retained. `bridgeToRemote` is governor-or-strategist gated, so the strategist can "
            "drive the migration without a further authorisation step."
        );

        govProposal.action(
            Base.BridgedWOETHStrategyProxy,
            "upgradeTo(address)",
            abi.encode(resolver.resolve("BRIDGED_WOETH_MIGRATION_STRATEGY_IMPL"))
        );
        govProposal.action(Base.BridgedWOETHStrategyProxy, "setMaxPerBridge(uint256)", abi.encode(MAX_PER_BRIDGE));
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        require(
            InitializeGovernedUpgradeabilityProxy(payable(Base.BridgedWOETHStrategyProxy)).implementation()
                == resolver.resolve("BRIDGED_WOETH_MIGRATION_STRATEGY_IMPL"),
            "BridgedWOETH strategy not upgraded"
        );

        BridgedWOETHMigrationStrategy migration = BridgedWOETHMigrationStrategy(payable(Base.BridgedWOETHStrategyProxy));

        require(migration.master() == resolver.resolve("OETHB_V3_MASTER_PROXY"), "Master not baked in");
        require(migration.maxPerBridge() == MAX_PER_BRIDGE, "Bridge cap not set");
        require(migration.ccipChainSelectorMainnet() == Mainnet.CCIPChainSelector, "Wrong CCIP destination");

        // V1 state read back through the proxy. `maxPriceDiffBps` is set at V1 initialisation and
        // is never zero on a live deployment, so a zero here means the layout shifted.
        require(migration.maxPriceDiffBps() > 0, "V1 storage not preserved across the upgrade");
        require(address(migration.bridgedWOETH()) == Base.BridgedWOETH, "wOETH mismatch");
        require(address(migration.oethb()) == Base.OETHBaseProxy, "OETHb mismatch");
    }
}

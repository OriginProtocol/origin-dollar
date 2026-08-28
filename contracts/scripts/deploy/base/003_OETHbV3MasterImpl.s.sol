// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {CreateXHelper} from "scripts/deploy/helpers/CreateXHelper.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";

// Contracts
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
import {MasterWOTokenStrategy} from "contracts/strategies/crosschainV3/MasterWOTokenStrategy.sol";
import {AbstractAdapter} from "contracts/strategies/crosschainV3/adapters/AbstractAdapter.sol";
import {CCIPAdapter} from "contracts/strategies/crosschainV3/adapters/CCIPAdapter.sol";
import {SuperbridgeAdapter, IL1StandardBridge} from "contracts/strategies/crosschainV3/adapters/SuperbridgeAdapter.sol";
import {BridgeAdapterProxy} from "contracts/proxies/create2/BridgeAdapterProxy.sol";
import {CrossChainStrategyProxy} from "contracts/proxies/create2/CrossChainStrategyProxy.sol";
import {InitializeGovernedUpgradeabilityProxy} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";

// Addresses
import {Base, CrossChain, Mainnet} from "tests/utils/Addresses.sol";

/// @title 003_OETHbV3MasterImpl
/// @notice Deploys the OETHb V3 Master strategy implementation and its two bridge adapters on Base.
/// @dev Master holds WETH plus a reported `remoteStrategyBalance`; it never custodies wOETH. The
///      two adapters cover one direction each:
///        * outbound Base -> Ethereum via `CCIPAdapter` (atomic message + token);
///        * inbound  Ethereum -> Base via `SuperbridgeAdapter` (split delivery — ETH arrives over
///          the canonical bridge and is auto-wrapped to WETH, the message arrives over CCIP).
///
///      Both adapters sit behind `BridgeAdapterProxy` deployed through CreateX, because the
///      adapter family validates inbound messages with `transportSender == address(this)` and so
///      needs the peer adapter on Ethereum at the same address.
contract $003_OETHbV3MasterImpl is AbstractDeployScript("003_OETHbV3MasterImpl") {
    using GovHelper for GovProposal;

    /// @notice CreateX salts for the adapter proxies.
    /// @dev MUST match `mainnet/006_OETHbV3RemoteImpl`.
    string internal constant CCIP_ADAPTER_PROXY_SALT = "OETHb V3 CCIPAdapter Proxy 1";
    string internal constant SUPERBRIDGE_ADAPTER_PROXY_SALT = "OETHb V3 SuperbridgeAdapter Proxy 1";

    /// @notice Per-receive destination gas limit for cross-chain message handling.
    /// @dev The budget CCIP hands Remote's `receiveMessage` on Ethereum, so it must cover
    ///      Remote's most expensive inbound handler end-to-end. See the derivation on
    ///      `CrossChain.OETHB_V3_DEST_GAS_LIMIT_BASE_TO_MAINNET`, which is asserted by
    ///      `tests/fork/mainnet/strategies/RemoteWOTokenStrategy` — keep the two in sync.
    uint32 internal constant DEST_GAS_LIMIT = CrossChain.OETHB_V3_DEST_GAS_LIMIT_BASE_TO_MAINNET;

    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        address masterProxy = resolver.resolve("OETHB_V3_MASTER_PROXY");

        // --- 1. Master implementation ---
        // No real platform: Master mirrors `bridgeAsset` as the registry pToken in `initialize`.
        MasterWOTokenStrategy masterImpl = new MasterWOTokenStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: CrossChain.zero, vaultAddress: Base.OETHBaseVaultProxy
            }),
            Base.WETH
        );
        _recordDeployment("OETHB_V3_MASTER_IMPL", address(masterImpl), type(MasterWOTokenStrategy).name);

        // --- 2. Point the proxy at it and hand governance to the Base timelock ---
        // The proxy runs `initialize(operator)` by delegatecall while the deployer is still
        // governor, and only then changes the governor, so this is a single transaction.
        CrossChainStrategyProxy(payable(masterProxy))
            .initialize(
                address(masterImpl),
                Base.timelock,
                abi.encodeCall(MasterWOTokenStrategy.initialize, (CrossChain.talosRelayer))
            );

        // --- 3. Adapter implementations ---
        // Deployed plain, not through CreateX: their addresses differ across chains and only the
        // proxy takes part in the peer-parity check. Chain-specific wiring is constructor-baked.
        CCIPAdapter ccipImpl = new CCIPAdapter(IRouterClient(Base.CCIPRouter));
        _recordDeployment("OETHB_V3_CCIP_ADAPTER_IMPL", address(ccipImpl), type(CCIPAdapter).name);

        // Base never sends outbound over Superbridge, so the L1StandardBridge slot is zero here;
        // the outbound entry points revert if invoked.
        SuperbridgeAdapter superImpl = new SuperbridgeAdapter(
            IL1StandardBridge(CrossChain.zero),
            IRouterClient(Base.CCIPRouter),
            Base.WETH // local WETH — `receive()` wraps incoming bridge ETH into it
        );
        _recordDeployment("OETHB_V3_SUPERBRIDGE_ADAPTER_IMPL", address(superImpl), type(SuperbridgeAdapter).name);

        // --- 4. Adapter proxies at their cross-chain addresses ---
        bytes memory adapterInitCode = CreateXHelper.proxyInitCode(type(BridgeAdapterProxy).creationCode, deployer);
        address ccipProxy = CreateXHelper.deploy(CCIP_ADAPTER_PROXY_SALT, adapterInitCode);
        _recordDeployment("OETHB_V3_CCIP_ADAPTER_PROXY", ccipProxy, type(BridgeAdapterProxy).name);
        address superProxy = CreateXHelper.deploy(SUPERBRIDGE_ADAPTER_PROXY_SALT, adapterInitCode);
        _recordDeployment("OETHB_V3_SUPERBRIDGE_ADAPTER_PROXY", superProxy, type(BridgeAdapterProxy).name);

        // --- 5. Initialise the adapter proxies, keeping the deployer as governor ---
        // Adapter configuration below is `onlyGovernor`, so governance moves to the timelock only
        // once the lanes are wired. `initialize` is itself `onlyGovernor` and the CreateX
        // constructor already set the deployer.
        InitializeGovernedUpgradeabilityProxy(payable(ccipProxy)).initialize(address(ccipImpl), deployer, "");
        InitializeGovernedUpgradeabilityProxy(payable(superProxy)).initialize(address(superImpl), deployer, "");

        // From here the proxy address is the adapter.
        CCIPAdapter ccipOutbound = CCIPAdapter(payable(ccipProxy));
        SuperbridgeAdapter superInbound = SuperbridgeAdapter(payable(superProxy));

        // --- 6. Lane configuration ---
        AbstractAdapter.ChainConfig memory lane = AbstractAdapter.ChainConfig({
            paused: false, chainSelector: Mainnet.CCIPChainSelector, destGasLimit: DEST_GAS_LIMIT
        });
        ccipOutbound.authorise(masterProxy, lane);
        superInbound.authorise(masterProxy, lane);

        // The multichain strategist can pause/unpause a lane for fast incident response.
        ccipOutbound.addStrategist(CrossChain.multichainStrategist);
        superInbound.addStrategist(CrossChain.multichainStrategist);

        // --- 7. Hand adapter governance to the Base timelock (claimed in the proposal below) ---
        ccipOutbound.transferGovernance(Base.timelock);
        superInbound.transferGovernance(Base.timelock);
    }

    // ==================== Governance Proposal ==================== //

    function _buildGovernanceProposal() internal override {
        address masterProxy = resolver.resolve("OETHB_V3_MASTER_PROXY");
        address ccipProxy = resolver.resolve("OETHB_V3_CCIP_ADAPTER_PROXY");
        address superProxy = resolver.resolve("OETHB_V3_SUPERBRIDGE_ADAPTER_PROXY");

        govProposal.setDescription(
            "Deploy OETHb V3 Master strategy + adapters on Base\n\n"
            "Claims governance on the two bridge adapter proxies and wires them into the Master "
            "strategy: CCIPAdapter for outbound Base -> Ethereum, SuperbridgeAdapter for inbound "
            "Ethereum -> Base. Master is not yet approved on the vault; that is a separate step."
        );

        govProposal.action(ccipProxy, "claimGovernance()", "");
        govProposal.action(superProxy, "claimGovernance()", "");
        govProposal.action(masterProxy, "setOutboundAdapter(address)", abi.encode(ccipProxy));
        govProposal.action(masterProxy, "setInboundAdapter(address)", abi.encode(superProxy));
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        address masterProxy = resolver.resolve("OETHB_V3_MASTER_PROXY");
        address ccipProxy = resolver.resolve("OETHB_V3_CCIP_ADAPTER_PROXY");
        address superProxy = resolver.resolve("OETHB_V3_SUPERBRIDGE_ADAPTER_PROXY");

        // The proxy points at this run's implementation and is governed by the timelock.
        require(
            InitializeGovernedUpgradeabilityProxy(payable(masterProxy)).implementation()
                == resolver.resolve("OETHB_V3_MASTER_IMPL"),
            "Master implementation not set"
        );

        MasterWOTokenStrategy master = MasterWOTokenStrategy(payable(masterProxy));
        require(master.governor() == Base.timelock, "Master not governed by timelock");
        require(master.operator() == CrossChain.talosRelayer, "Master operator not set");
        require(master.vaultAddress() == Base.OETHBaseVaultProxy, "Master vault mismatch");
        require(master.bridgeAsset() == Base.WETH, "Master bridgeAsset mismatch");

        // Adapters: wired in the right direction and governed by the timelock.
        require(master.outboundAdapter() == ccipProxy, "Outbound adapter not wired");
        require(master.inboundAdapter() == superProxy, "Inbound adapter not wired");

        CCIPAdapter ccipOutbound = CCIPAdapter(payable(ccipProxy));
        SuperbridgeAdapter superInbound = SuperbridgeAdapter(payable(superProxy));
        require(ccipOutbound.governor() == Base.timelock, "CCIP adapter not governed by timelock");
        require(superInbound.governor() == Base.timelock, "Superbridge adapter not governed by timelock");
        require(ccipOutbound.authorised(masterProxy), "Master not authorised on CCIP adapter");
        require(superInbound.authorised(masterProxy), "Master not authorised on Superbridge adapter");
        require(
            ccipOutbound.strategists(CrossChain.multichainStrategist)
                && superInbound.strategists(CrossChain.multichainStrategist),
            "Strategist not added on adapters"
        );

        // The lane the gas budget was measured against.
        (bool paused, uint64 chainSelector, uint32 destGasLimit) = ccipOutbound.laneConfig(masterProxy);
        require(!paused, "Outbound lane is paused");
        require(chainSelector == Mainnet.CCIPChainSelector, "Outbound lane targets the wrong chain");
        require(destGasLimit == DEST_GAS_LIMIT, "Outbound lane gas limit mismatch");
    }
}

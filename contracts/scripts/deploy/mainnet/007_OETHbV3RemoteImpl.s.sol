// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";
import {CreateXHelper} from "scripts/deploy/helpers/CreateXHelper.sol";
import {GovHelper} from "scripts/deploy/helpers/GovHelper.sol";
import {GovProposal} from "scripts/deploy/helpers/DeploymentTypes.sol";

// Contracts
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
import {RemoteWOTokenStrategy} from "contracts/strategies/crosschainV3/RemoteWOTokenStrategy.sol";
import {AbstractAdapter} from "contracts/strategies/crosschainV3/adapters/AbstractAdapter.sol";
import {CCIPAdapter} from "contracts/strategies/crosschainV3/adapters/CCIPAdapter.sol";
import {SuperbridgeAdapter, IL1StandardBridge} from "contracts/strategies/crosschainV3/adapters/SuperbridgeAdapter.sol";
import {BridgeAdapterProxy} from "contracts/proxies/create2/BridgeAdapterProxy.sol";
import {CrossChainStrategyProxy} from "contracts/proxies/create2/CrossChainStrategyProxy.sol";
import {InitializeGovernedUpgradeabilityProxy} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";

// Addresses
import {Base, CrossChain, Mainnet} from "tests/utils/Addresses.sol";

/// @title 007_OETHbV3RemoteImpl
/// @notice Deploys the OETHb V3 Remote strategy implementation and its two bridge adapters on Ethereum.
/// @dev Remote has no vault. It custodies wOETH, mints and redeems OETH through the OETH vault, and
///      reports its balance back to Master on Base. The adapters mirror the Base side, with the
///      directions reversed:
///        * outbound Ethereum -> Base via `SuperbridgeAdapter` (split delivery — WETH is unwrapped
///          and sent as native ETH over the canonical bridge, the message goes over CCIP);
///        * inbound  Base -> Ethereum via `CCIPAdapter` (atomic message + token).
contract $007_OETHbV3RemoteImpl is AbstractDeployScript("007_OETHbV3RemoteImpl") {
    using GovHelper for GovProposal;

    /// @notice CreateX salts for the adapter proxies.
    /// @dev MUST match `base/003_OETHbV3MasterImpl`.
    string internal constant CCIP_ADAPTER_PROXY_SALT = "OETHb V3 CCIPAdapter Proxy 1";
    string internal constant SUPERBRIDGE_ADAPTER_PROXY_SALT = "OETHb V3 SuperbridgeAdapter Proxy 1";

    /// @notice Per-receive destination gas limit on the Ethereum -> Base lane.
    /// @dev Master's inbound handlers are terminal and split delivery moves the expensive leg out
    ///      of the CCIP callback, so this is far below the Base -> Ethereum budget. CCIP bills the
    ///      declared limit whether it is used or not.
    uint32 internal constant DEST_GAS_LIMIT = CrossChain.OETHB_V3_DEST_GAS_LIMIT_MAINNET_TO_BASE;

    /// @notice OP Stack canonical bridge `minGasLimit` hint for the ETH deposit into Base.
    /// @dev Per-sender on the adapter. 200k is the OP Stack default and covers the plain ETH
    ///      transfer plus Master's `receive()` wrap into WETH.
    uint32 internal constant CANONICAL_MIN_GAS = 200_000;

    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        address remoteProxy = resolver.resolve("OETHB_V3_REMOTE_PROXY");

        // --- 1. Remote implementation ---
        // No vault; wOETH stands in as the "platform" for the strategy registry.
        RemoteWOTokenStrategy remoteImpl = new RemoteWOTokenStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: Mainnet.WOETHProxy, vaultAddress: CrossChain.zero
            }),
            Mainnet.WETH,
            Mainnet.OETHProxy,
            Mainnet.WOETHProxy,
            Mainnet.OETHVaultProxy
        );
        _recordDeployment("OETHB_V3_REMOTE_IMPL", address(remoteImpl), type(RemoteWOTokenStrategy).name);

        // --- 2. Point the proxy at it and hand governance to the mainnet Timelock ---
        CrossChainStrategyProxy(payable(remoteProxy))
            .initialize(
                address(remoteImpl),
                Mainnet.Timelock,
                abi.encodeCall(RemoteWOTokenStrategy.initialize, (CrossChain.talosRelayer))
            );

        // --- 3. Adapter implementations ---
        // Deployed plain: only the proxy takes part in the cross-chain address parity check.
        SuperbridgeAdapter superImpl = new SuperbridgeAdapter(
            IL1StandardBridge(Mainnet.BaseL1StandardBridge), IRouterClient(Mainnet.ccipRouterMainnet), Mainnet.WETH
        );
        _recordDeployment("OETHB_V3_SUPERBRIDGE_ADAPTER_IMPL", address(superImpl), type(SuperbridgeAdapter).name);

        CCIPAdapter ccipImpl = new CCIPAdapter(IRouterClient(Mainnet.ccipRouterMainnet));
        _recordDeployment("OETHB_V3_CCIP_ADAPTER_IMPL", address(ccipImpl), type(CCIPAdapter).name);

        // --- 4. Adapter proxies at their cross-chain addresses ---
        bytes memory adapterInitCode = CreateXHelper.proxyInitCode(type(BridgeAdapterProxy).creationCode, deployer);
        address superProxy = CreateXHelper.deploy(SUPERBRIDGE_ADAPTER_PROXY_SALT, adapterInitCode);
        _recordDeployment("OETHB_V3_SUPERBRIDGE_ADAPTER_PROXY", superProxy, type(BridgeAdapterProxy).name);
        address ccipProxy = CreateXHelper.deploy(CCIP_ADAPTER_PROXY_SALT, adapterInitCode);
        _recordDeployment("OETHB_V3_CCIP_ADAPTER_PROXY", ccipProxy, type(BridgeAdapterProxy).name);

        // --- 5. Initialise the adapter proxies, keeping the deployer as governor ---
        InitializeGovernedUpgradeabilityProxy(payable(superProxy)).initialize(address(superImpl), deployer, "");
        InitializeGovernedUpgradeabilityProxy(payable(ccipProxy)).initialize(address(ccipImpl), deployer, "");

        SuperbridgeAdapter superOutbound = SuperbridgeAdapter(payable(superProxy));
        CCIPAdapter ccipInbound = CCIPAdapter(payable(ccipProxy));

        // --- 6. Lane configuration ---
        AbstractAdapter.ChainConfig memory lane = AbstractAdapter.ChainConfig({
            paused: false, chainSelector: Base.CCIPChainSelector, destGasLimit: DEST_GAS_LIMIT
        });
        superOutbound.authorise(remoteProxy, lane);
        ccipInbound.authorise(remoteProxy, lane);

        // Superbridge additionally needs the canonical bridge's min-gas hint, per sender.
        superOutbound.setCanonicalMinGas(remoteProxy, CANONICAL_MIN_GAS);

        // The multichain strategist can pause/unpause a lane for fast incident response.
        superOutbound.addStrategist(CrossChain.multichainStrategist);
        ccipInbound.addStrategist(CrossChain.multichainStrategist);

        // --- 7. Hand adapter governance to the Timelock (claimed in the proposal below) ---
        superOutbound.transferGovernance(Mainnet.Timelock);
        ccipInbound.transferGovernance(Mainnet.Timelock);
    }

    // ==================== Governance Proposal ==================== //

    function _buildGovernanceProposal() internal override {
        address remoteProxy = resolver.resolve("OETHB_V3_REMOTE_PROXY");
        address superProxy = resolver.resolve("OETHB_V3_SUPERBRIDGE_ADAPTER_PROXY");
        address ccipProxy = resolver.resolve("OETHB_V3_CCIP_ADAPTER_PROXY");

        govProposal.setDescription(
            "Deploy OETHb V3 Remote strategy + adapters on Ethereum\n\n"
            "Claims governance on the two bridge adapter proxies and wires them into the Remote "
            "strategy: SuperbridgeAdapter for outbound Ethereum -> Base, CCIPAdapter for inbound "
            "Base -> Ethereum. Also primes the strategy's token approvals."
        );

        govProposal.action(superProxy, "claimGovernance()", "");
        govProposal.action(ccipProxy, "claimGovernance()", "");
        govProposal.action(remoteProxy, "setOutboundAdapter(address)", abi.encode(superProxy));
        govProposal.action(remoteProxy, "setInboundAdapter(address)", abi.encode(ccipProxy));
        // Primes the static (token, spender) pairs Remote transfers through:
        //   bridgeAsset -> oTokenVault, oToken -> oTokenVault, oToken -> woToken.
        // The dynamic bridgeAsset -> outboundAdapter approval is set by setOutboundAdapter above.
        govProposal.action(remoteProxy, "safeApproveAllTokens()", "");
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        address remoteProxy = resolver.resolve("OETHB_V3_REMOTE_PROXY");
        address superProxy = resolver.resolve("OETHB_V3_SUPERBRIDGE_ADAPTER_PROXY");
        address ccipProxy = resolver.resolve("OETHB_V3_CCIP_ADAPTER_PROXY");

        require(
            InitializeGovernedUpgradeabilityProxy(payable(remoteProxy)).implementation()
                == resolver.resolve("OETHB_V3_REMOTE_IMPL"),
            "Remote implementation not set"
        );

        RemoteWOTokenStrategy remote = RemoteWOTokenStrategy(payable(remoteProxy));
        require(remote.governor() == Mainnet.Timelock, "Remote not governed by timelock");
        require(remote.operator() == CrossChain.talosRelayer, "Remote operator not set");
        require(remote.oToken() == Mainnet.OETHProxy, "Remote oToken mismatch");
        require(remote.woToken() == Mainnet.WOETHProxy, "Remote woToken mismatch");
        require(remote.oTokenVault() == Mainnet.OETHVaultProxy, "Remote oTokenVault mismatch");

        // Adapters: wired in the right direction and governed by the timelock.
        require(remote.outboundAdapter() == superProxy, "Outbound adapter not wired");
        require(remote.inboundAdapter() == ccipProxy, "Inbound adapter not wired");

        SuperbridgeAdapter superOutbound = SuperbridgeAdapter(payable(superProxy));
        CCIPAdapter ccipInbound = CCIPAdapter(payable(ccipProxy));
        require(superOutbound.governor() == Mainnet.Timelock, "Superbridge adapter not governed by timelock");
        require(ccipInbound.governor() == Mainnet.Timelock, "CCIP adapter not governed by timelock");
        require(superOutbound.authorised(remoteProxy), "Remote not authorised on Superbridge adapter");
        require(ccipInbound.authorised(remoteProxy), "Remote not authorised on CCIP adapter");
        require(
            superOutbound.strategists(CrossChain.multichainStrategist)
                && ccipInbound.strategists(CrossChain.multichainStrategist),
            "Strategist not added on adapters"
        );
        require(superOutbound.canonicalMinGasFor(remoteProxy) == CANONICAL_MIN_GAS, "Canonical min gas not set");

        (bool paused, uint64 chainSelector, uint32 destGasLimit) = superOutbound.laneConfig(remoteProxy);
        require(!paused, "Outbound lane is paused");
        require(chainSelector == Base.CCIPChainSelector, "Outbound lane targets the wrong chain");
        require(destGasLimit == DEST_GAS_LIMIT, "Outbound lane gas limit mismatch");
    }
}

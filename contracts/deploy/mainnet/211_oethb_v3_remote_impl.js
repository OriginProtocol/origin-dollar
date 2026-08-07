const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const {
  getCreate2ProxyAddress,
  deployProxyWithCreateX,
} = require("../deployActions");

// Per-receive destination gas limit for cross-chain message handling.
const DEFAULT_DEST_GAS_LIMIT = 500000;

// Canonical bridge minGasLimit hint for the ETH deposit (OP Stack default).
const CANONICAL_MIN_GAS = 200000;

// CreateX/CREATE2 salts for the adapter proxies. MUST match the Base-side salts used
// in `deploy/base/101_oethb_v3_master_impl.js` so the proxy addresses are
// identical across chains (peer-parity requirement on the
// `transportSender == address(this)` check).
const CCIP_ADAPTER_PROXY_SALT = "OETHb V3 CCIPAdapter Proxy 1";
const SUPERBRIDGE_ADAPTER_PROXY_SALT = "OETHb V3 SuperbridgeAdapter Proxy 1";

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "211_oethb_v3_remote_impl",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
    dependencies: ["210_oethb_v3_remote_proxy"],
  },
  async ({ deployWithConfirmation, withConfirmation, ethers }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // --- Resolve dependencies ---
    const remoteProxyAddress = await getCreate2ProxyAddress(
      "OETHbV3RemoteProxy"
    );
    console.log(`OETHbV3RemoteProxy resolved at: ${remoteProxyAddress}`);

    // --- 1. Deploy Remote impl ---
    await deployWithConfirmation("RemoteWOTokenStrategy", [
      {
        platformAddress: addresses.mainnet.WOETHProxy,
        vaultAddress: addresses.zero,
      },
      addresses.mainnet.WETH,
      addresses.mainnet.OETHProxy,
      addresses.mainnet.WOETHProxy,
      addresses.mainnet.OETHVaultProxy,
    ]);
    const dRemoteImpl = await ethers.getContract("RemoteWOTokenStrategy");
    console.log(`RemoteWOTokenStrategy impl: ${dRemoteImpl.address}`);

    // --- 2. Initialise the strategy proxy: impl + governor=Timelock + initialize(operator) ---
    const cRemoteProxy = await ethers.getContractAt(
      "CrossChainStrategyProxy",
      remoteProxyAddress
    );
    const initData = dRemoteImpl.interface.encodeFunctionData(
      "initialize(address)",
      [addresses.talosRelayer]
    );
    const proxyInitCalldata = cRemoteProxy.interface.encodeFunctionData(
      "initialize(address,address,bytes)",
      [dRemoteImpl.address, addresses.mainnet.Timelock, initData]
    );
    await withConfirmation(
      sDeployer.sendTransaction({
        to: cRemoteProxy.address,
        data: proxyInitCalldata,
      })
    );

    // --- 3. Deploy adapter impls (plain; chain-specific args baked into bytecode) ---
    //
    // Adapters live behind `BridgeAdapterProxy` (CreateX/CREATE2 → identical address on both
    // chains, mandatory for the `transportSender == address(this)` peer-parity check).
    // The impls are deployed plain — their addresses differ across chains but only the
    // proxy is part of the parity check.
    //
    // Outbound (E→B, split delivery): SuperbridgeAdapter — ETH-only. Takes WETH from
    // Remote, unwraps to native ETH, sends via the canonical bridge.
    await deployWithConfirmation("SuperbridgeAdapter", [
      addresses.mainnet.BaseL1StandardBridge,
      addresses.mainnet.ccipRouterMainnet,
      addresses.mainnet.WETH,
    ]);
    const dSuperImpl = await ethers.getContract("SuperbridgeAdapter");
    console.log(`SuperbridgeAdapter impl: ${dSuperImpl.address}`);

    // Inbound (B→E, atomic): CCIPAdapter
    await deployWithConfirmation("CCIPAdapter", [
      addresses.mainnet.ccipRouterMainnet,
    ]);
    const dCCIPImpl = await ethers.getContract("CCIPAdapter");
    console.log(`CCIPAdapter impl: ${dCCIPImpl.address}`);

    // --- 4. Deploy adapter proxies via CreateX/CREATE2 (deterministic, peer-parity addresses) ---
    const superProxyAddr = await deployProxyWithCreateX(
      SUPERBRIDGE_ADAPTER_PROXY_SALT,
      "BridgeAdapterProxy",
      false,
      null,
      "OETHbV3SuperbridgeAdapterProxy"
    );
    console.log(`SuperbridgeAdapter proxy: ${superProxyAddr}`);
    const ccipProxyAddr = await deployProxyWithCreateX(
      CCIP_ADAPTER_PROXY_SALT,
      "BridgeAdapterProxy",
      false,
      null,
      "OETHbV3CCIPAdapterProxy"
    );
    console.log(`CCIPAdapter proxy: ${ccipProxyAddr}`);

    // --- 5. Initialise adapter proxies to point at impls. Proxy constructor set
    //         governor = deployer; `initialize` is onlyGovernor and re-asserts governor.
    const cSuperProxyRaw = await ethers.getContractAt(
      "InitializeGovernedUpgradeabilityProxy",
      superProxyAddr,
      sDeployer
    );
    await withConfirmation(
      cSuperProxyRaw["initialize(address,address,bytes)"](
        dSuperImpl.address,
        deployerAddr,
        "0x"
      )
    );
    const cCCIPProxyRaw = await ethers.getContractAt(
      "InitializeGovernedUpgradeabilityProxy",
      ccipProxyAddr,
      sDeployer
    );
    await withConfirmation(
      cCCIPProxyRaw["initialize(address,address,bytes)"](
        dCCIPImpl.address,
        deployerAddr,
        "0x"
      )
    );

    // After this, the proxy address is the "real" adapter — configure it as such.
    const dSuperOut = await ethers.getContractAt(
      "SuperbridgeAdapter",
      superProxyAddr
    );
    const dCCIPRx = await ethers.getContractAt("CCIPAdapter", ccipProxyAddr);

    // --- 6. Adapter configuration ---
    // ChainConfig fields: { paused, chainSelector, destGasLimit }
    const remoteChainCfg = {
      paused: false,
      chainSelector: addresses.base.CCIPChainSelector,
      destGasLimit: DEFAULT_DEST_GAS_LIMIT,
    };
    await withConfirmation(
      dSuperOut.connect(sDeployer).authorise(remoteProxyAddress, remoteChainCfg)
    );
    await withConfirmation(
      dCCIPRx.connect(sDeployer).authorise(remoteProxyAddress, remoteChainCfg)
    );
    // Superbridge needs the OP Stack canonical bridge min-gas hint per sender.
    await withConfirmation(
      dSuperOut
        .connect(sDeployer)
        .setCanonicalMinGas(remoteProxyAddress, CANONICAL_MIN_GAS)
    );
    // Strategist (multichain strategist) can pause/unpause lanes for fast incident response.
    await withConfirmation(
      dSuperOut.connect(sDeployer).addStrategist(addresses.multichainStrategist)
    );
    await withConfirmation(
      dCCIPRx.connect(sDeployer).addStrategist(addresses.multichainStrategist)
    );

    // --- 7. Transfer adapter proxy governance to mainnet Timelock ---
    await withConfirmation(
      dSuperOut
        .connect(sDeployer)
        .transferGovernance(addresses.mainnet.Timelock)
    );
    await withConfirmation(
      dCCIPRx.connect(sDeployer).transferGovernance(addresses.mainnet.Timelock)
    );

    const cRemote = await ethers.getContractAt(
      "RemoteWOTokenStrategy",
      remoteProxyAddress
    );

    return {
      name: "Deploy OETHb V3 Remote strategy + adapters on Ethereum",
      actions: [
        // Timelock claims governance on the two adapter proxies.
        {
          contract: dSuperOut,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: dCCIPRx,
          signature: "claimGovernance()",
          args: [],
        },
        // Wire the adapter PROXY addresses into Remote.
        {
          contract: cRemote,
          signature: "setOutboundAdapter(address)",
          args: [superProxyAddr],
        },
        {
          contract: cRemote,
          signature: "setInboundAdapter(address)",
          args: [ccipProxyAddr],
        },
        // safeApproveAllTokens primes the static (token, spender) pairs Remote uses:
        //   bridgeAsset→oTokenVault, oToken→oTokenVault, oToken→woToken.
        // The dynamic bridgeAsset→outboundAdapter approval is set by setOutboundAdapter above.
        {
          contract: cRemote,
          signature: "safeApproveAllTokens()",
          args: [],
        },
      ],
    };
  }
);

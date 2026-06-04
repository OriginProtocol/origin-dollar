const fs = require("fs");
const path = require("path");

const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { getCreate2ProxyAddress } = require("../deployActions");

// CCIP chain selectors (Chainlink CCIP docs).
const CCIP_CHAIN_SELECTOR_BASE = "15971525489660198786";

function readDeploymentAddress(networkName, contractName) {
  const artifactPath = path.resolve(
    __dirname,
    `../../deployments/${networkName}/${contractName}.json`
  );
  if (!fs.existsSync(artifactPath)) return null;
  try {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    return artifact && artifact.address ? artifact.address : null;
  } catch (e) {
    return null;
  }
}

// OP Stack canonical bridge for Base on Ethereum (the L1StandardBridge).
const BASE_L1_STANDARD_BRIDGE = "0x3154Cf16ccdb4C6d922629664174b904d80F2C35";

// Per-receive destination gas limit for cross-chain message handling.
const DEFAULT_DEST_GAS_LIMIT = 500000;

// Canonical bridge minGasLimit hint for the ERC20 deposit (OP Stack default).
const CANONICAL_MIN_GAS = 200000;

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

    // --- 2. Initialise the proxy: impl + governor=Timelock + initialize(operator) ---
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

    // --- 3. Deploy adapters (deployer = initial governor) ---
    // Outbound (E→B, split delivery): SuperbridgeAdapter — ETH-only. Takes WETH from
    // Remote, unwraps to native ETH, sends via the canonical bridge. `_weth` is required
    // (mainnet WETH); mainnet-side `receive()` keeps incoming ETH raw for CCIP fee budget.
    await deployWithConfirmation("SuperbridgeAdapter", [
      BASE_L1_STANDARD_BRIDGE,
      addresses.mainnet.ccipRouterMainnet,
      addresses.mainnet.WETH,
    ]);
    const dSuperOut = await ethers.getContract("SuperbridgeAdapter");
    console.log(`SuperbridgeAdapter: ${dSuperOut.address}`);

    // Inbound (B→E, atomic): CCIPAdapter
    await deployWithConfirmation("CCIPAdapter", [
      addresses.mainnet.ccipRouterMainnet,
    ]);
    const dCCIPRx = await ethers.getContract("CCIPAdapter");
    console.log(`CCIPAdapter: ${dCCIPRx.address}`);

    // --- 4. Adapter configuration ---
    // Remote is the only authorised sender on the outbound adapter for the Base leg.
    // Peer Base-side receiver address is set in a follow-up tx once known.
    await withConfirmation(
      dSuperOut
        .connect(sDeployer)
        .authoriseSender(
          remoteProxyAddress,
          CCIP_CHAIN_SELECTOR_BASE,
          addresses.zero /* peerReceiver — set later */
        )
    );
    await withConfirmation(
      dSuperOut
        .connect(sDeployer)
        .setDestGasLimit(remoteProxyAddress, DEFAULT_DEST_GAS_LIMIT)
    );
    await withConfirmation(
      dSuperOut
        .connect(sDeployer)
        .setCanonicalMinGas(remoteProxyAddress, CANONICAL_MIN_GAS)
    );

    // Peer route is registered below in the cross-chain peer wiring block once the
    // Base artifact is available.

    // --- 5. Transfer adapter governance to mainnet Timelock ---
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

    // Cross-chain peer wiring (if Base-side deploys have already run).
    const baseSuperRx = readDeploymentAddress("base", "SuperbridgeAdapter");
    const baseCCIPOut = readDeploymentAddress("base", "CCIPAdapter");

    const peerWiringActions = [];
    if (baseSuperRx && baseCCIPOut) {
      console.log(
        `Wiring Mainnet peers: outbound→${baseSuperRx}, receiver←${baseCCIPOut}`
      );
      peerWiringActions.push({
        contract: dSuperOut,
        signature: "setPeerReceiver(address,address)",
        args: [remoteProxyAddress, baseSuperRx],
      });
      // CREATE2 parity: the source strategy on Base (Master) is at the same address
      // as the destination strategy here (Remote). Whitelist that address on the
      // inbound CCIP adapter.
      peerWiringActions.push({
        contract: dCCIPRx,
        signature: "authorise(address)",
        args: [remoteProxyAddress],
      });
    } else {
      console.log(
        "Base adapter artifacts missing — peer wiring deferred to 212_oethb_v3_peer_wiring."
      );
    }

    return {
      name: "Deploy OETHb V3 Remote strategy + adapters on Ethereum",
      actions: [
        // Timelock claims governance on the two adapters.
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
        // Wire the adapters into Remote.
        {
          contract: cRemote,
          signature: "setOutboundAdapter(address)",
          args: [dSuperOut.address],
        },
        {
          contract: cRemote,
          signature: "setInboundAdapter(address)",
          args: [dCCIPRx.address],
        },
        // safeApproveAllTokens primes the static (token, spender) pairs Remote uses:
        //   bridgeAsset→oTokenVault, oToken→oTokenVault, oToken→woToken.
        // The dynamic bridgeAsset→outboundAdapter approval is set by setOutboundAdapter above.
        {
          contract: cRemote,
          signature: "safeApproveAllTokens()",
          args: [],
        },
        // Cross-chain peer wiring (no-op when base adapters not yet deployed).
        ...peerWiringActions,
      ],
    };
  }
);

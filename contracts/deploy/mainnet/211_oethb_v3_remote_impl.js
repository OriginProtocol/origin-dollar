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
const DEFAULT_DEST_GAS_LIMIT = 500_000;

// Canonical bridge minGasLimit hint for the ERC20 deposit (OP Stack default).
const CANONICAL_MIN_GAS = 200_000;

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
    await deployWithConfirmation("RemoteV3Strategy", [
      {
        platformAddress: addresses.mainnet.WOETHProxy,
        vaultAddress: addresses.zero,
      },
      addresses.mainnet.WETH,
      addresses.mainnet.OETHProxy,
      addresses.mainnet.WOETHProxy,
      addresses.mainnet.OETHVaultProxy,
    ]);
    const dRemoteImpl = await ethers.getContract("RemoteV3Strategy");
    console.log(`RemoteV3Strategy impl: ${dRemoteImpl.address}`);

    // --- 2. Initialise the proxy: impl + governor=Timelock + initialize(operator) ---
    const cRemoteProxy = await ethers.getContractAt(
      "CrossChainStrategyProxy",
      remoteProxyAddress
    );
    const initData = dRemoteImpl.interface.encodeFunctionData(
      "initialize(address)",
      [addresses.talosRelayer]
    );
    await withConfirmation(
      cRemoteProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dRemoteImpl.address,
          addresses.mainnet.Timelock,
          initData
        )
    );

    // --- 3. Deploy adapters (deployer = initial governor) ---
    // Outbound (E→B, split delivery): SuperbridgeCanonicalOutboundAdapter
    await deployWithConfirmation("SuperbridgeCanonicalOutboundAdapter", [
      BASE_L1_STANDARD_BRIDGE,
      addresses.mainnet.ccipRouterMainnet,
    ]);
    const dSuperOut = await ethers.getContract(
      "SuperbridgeCanonicalOutboundAdapter"
    );
    console.log(`SuperbridgeCanonicalOutboundAdapter: ${dSuperOut.address}`);

    // Inbound (B→E, atomic): CCIPReceiverAdapter
    await deployWithConfirmation("CCIPReceiverAdapter", [
      addresses.mainnet.ccipRouterMainnet,
    ]);
    const dCCIPRx = await ethers.getContract("CCIPReceiverAdapter");
    console.log(`CCIPReceiverAdapter: ${dCCIPRx.address}`);

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
    // Map WETH L1 → WETH L2 for the canonical bridge.
    await withConfirmation(
      dSuperOut
        .connect(sDeployer)
        .mapRemoteToken(addresses.mainnet.WETH, addresses.base.WETH)
    );

    await withConfirmation(
      dCCIPRx.connect(sDeployer).setStrategy(remoteProxyAddress)
    );

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
      "RemoteV3Strategy",
      remoteProxyAddress
    );

    // Cross-chain peer wiring (if Base-side deploys have already run).
    const baseSuperRx = readDeploymentAddress(
      "base",
      "SuperbridgeCCIPReceiverAdapter"
    );
    const baseCCIPOut = readDeploymentAddress("base", "CCIPOutboundAdapter");

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
      peerWiringActions.push({
        contract: dCCIPRx,
        signature: "setPeer(address,uint64)",
        args: [baseCCIPOut, CCIP_CHAIN_SELECTOR_BASE],
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
          signature: "setReceiverAdapter(address)",
          args: [dCCIPRx.address],
        },
        // safeApproveAllTokens primes bridgeAsset→oTokenVault + oToken→woToken approvals.
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

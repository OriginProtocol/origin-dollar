const fs = require("fs");
const path = require("path");

const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { getCreate2ProxyAddress } = require("../deployActions");

// CCIP chain selector for Ethereum mainnet (Chainlink CCIP docs).
const CCIP_CHAIN_SELECTOR_MAINNET = "5009297550715157269";

// Default per-receive destination gas limit for cross-chain message handling.
const DEFAULT_DEST_GAS_LIMIT = 500000;

// Best-effort read of a deployed contract's address from another network's
// hardhat-deploy artifacts. Returns `null` if the artifact isn't present yet
// (e.g., the cross-chain side hasn't deployed). Used to wire peer adapter
// addresses across chains without forcing the operator to maintain a
// separate address registry.
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

module.exports = deployOnBase(
  {
    deployName: "101_oethb_v3_master_impl",
    dependencies: ["100_oethb_v3_master_proxy"],
  },
  async ({ deployWithConfirmation, withConfirmation, ethers }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // --- Resolve dependencies on chain ---
    const masterProxyAddress = await getCreate2ProxyAddress(
      "OETHbV3MasterProxy"
    );
    console.log(`OETHbV3MasterProxy resolved at: ${masterProxyAddress}`);

    const cOETHBaseVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHb = await ethers.getContract("OETHBaseProxy");

    // --- 1. Deploy Master impl ---
    await deployWithConfirmation("MasterWOTokenStrategy", [
      {
        platformAddress: addresses.zero,
        vaultAddress: cOETHBaseVaultProxy.address,
      },
      addresses.base.WETH,
      cOETHb.address,
    ]);
    const dMasterImpl = await ethers.getContract("MasterWOTokenStrategy");
    console.log(`MasterWOTokenStrategy impl: ${dMasterImpl.address}`);

    // --- 2. Initialise the proxy: set impl, set governor=timelock, call initialize(operator) ---
    const cMasterProxy = await ethers.getContractAt(
      "CrossChainStrategyProxy",
      masterProxyAddress
    );
    const initData = dMasterImpl.interface.encodeFunctionData(
      "initialize(address)",
      [addresses.talosRelayer]
    );
    const proxyInitCalldata = cMasterProxy.interface.encodeFunctionData(
      "initialize(address,address,bytes)",
      [dMasterImpl.address, addresses.base.timelock, initData]
    );
    await withConfirmation(
      sDeployer.sendTransaction({
        to: cMasterProxy.address,
        data: proxyInitCalldata,
      })
    );

    // --- 3. Deploy adapters (deployer is initial governor; transferred to timelock at end) ---
    // Outbound (B→E): CCIPAdapter
    await deployWithConfirmation("CCIPAdapter", [addresses.base.CCIPRouter]);
    const dCCIPOutbound = await ethers.getContract("CCIPAdapter");
    console.log(`CCIPAdapter: ${dCCIPOutbound.address}`);

    // Inbound (E→B): SuperbridgeAdapter — split delivery, ETH-only. Tokens arrive as
    // native ETH via the canonical bridge; `receive()` auto-wraps to WETH so Master sees
    // its `bridgeAsset = WETH`. Base side never sends outbound via this adapter, so the
    // L1StandardBridge constructor slot is passed as address(0); outbound entry points
    // revert if invoked.
    await deployWithConfirmation("SuperbridgeAdapter", [
      addresses.zero,
      addresses.base.CCIPRouter,
      addresses.base.WETH, // local WETH (wraps incoming bridge ETH)
    ]);
    const dSuperRx = await ethers.getContract("SuperbridgeAdapter");
    console.log(`SuperbridgeAdapter: ${dSuperRx.address}`);

    // --- 4. Adapter configuration (deployer is governor here, so do it now) ---
    // Master is the only authorised sender on this outbound adapter for the Ethereum leg.
    // The peer (Remote-side CCIPAdapter address) is left as placeholder; final wiring
    // happens after the Ethereum-side deploy when both adapter addresses are known.
    await withConfirmation(
      dCCIPOutbound
        .connect(sDeployer)
        .authoriseSender(
          masterProxyAddress,
          CCIP_CHAIN_SELECTOR_MAINNET,
          addresses.zero /* peerReceiver — set later */
        )
    );
    await withConfirmation(
      dCCIPOutbound
        .connect(sDeployer)
        .setDestGasLimit(masterProxyAddress, DEFAULT_DEST_GAS_LIMIT)
    );

    // Peer route (Remote-side SuperbridgeAdapter) registered below in the
    // cross-chain peer wiring block once the mainnet artifact is available.

    // --- 5. Transfer adapter governance to Base timelock ---
    await withConfirmation(
      dCCIPOutbound
        .connect(sDeployer)
        .transferGovernance(addresses.base.timelock)
    );
    await withConfirmation(
      dSuperRx.connect(sDeployer).transferGovernance(addresses.base.timelock)
    );

    // --- 6. Resolve Master as IStrategy / IGovernable for the governance actions ---
    const cMaster = await ethers.getContractAt(
      "MasterWOTokenStrategy",
      masterProxyAddress
    );

    // --- 7. Cross-chain peer wiring (if Ethereum-side deploys have already run) ---
    // Read mainnet adapter addresses from the cross-chain deployment artifacts. If
    // mainnet hasn't been deployed yet, the wiring is left as a follow-up and the
    // operator must run `105_oethb_v3_peer_wiring` after mainnet 211 completes.
    const mainnetCCIPReceiver = readDeploymentAddress("mainnet", "CCIPAdapter");
    const mainnetSuperOut = readDeploymentAddress(
      "mainnet",
      "SuperbridgeAdapter"
    );

    const peerWiringActions = [];
    if (mainnetCCIPReceiver && mainnetSuperOut) {
      console.log(
        `Wiring Base peers: outbound→${mainnetCCIPReceiver}, inbound authorises Master`
      );
      // Outbound: Master's messages headed to Ethereum land at the mainnet CCIP
      // receiver, so set that as the peer.
      peerWiringActions.push({
        contract: dCCIPOutbound,
        signature: "setPeerReceiver(address,address)",
        args: [masterProxyAddress, mainnetCCIPReceiver],
      });
      // Inbound: with CREATE2 parity, the source strategy on Ethereum (Remote) has the
      // same address as the destination strategy here (Master). Whitelist that single
      // address; the adapter forwards inbound messages to it on this chain.
      peerWiringActions.push({
        contract: dSuperRx,
        signature: "authorise(address)",
        args: [masterProxyAddress],
      });
    } else {
      console.log(
        "Mainnet adapter artifacts missing — peer wiring deferred to 105_oethb_v3_peer_wiring."
      );
    }

    return {
      name: "Deploy OETHb V3 Master strategy + adapters on Base",
      actions: [
        // Timelock claims governance on the two adapters.
        {
          contract: dCCIPOutbound,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: dSuperRx,
          signature: "claimGovernance()",
          args: [],
        },
        // Wire the adapters into Master (governor-gated on Master).
        {
          contract: cMaster,
          signature: "setOutboundAdapter(address)",
          args: [dCCIPOutbound.address],
        },
        {
          contract: cMaster,
          signature: "setInboundAdapter(address)",
          args: [dSuperRx.address],
        },
        // Cross-chain peer wiring (no-op when mainnet adapters not yet deployed).
        ...peerWiringActions,
      ],
    };
  }
);

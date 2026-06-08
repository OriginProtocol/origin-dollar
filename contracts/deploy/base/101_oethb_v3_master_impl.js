const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { getCreate2ProxyAddress } = require("../deployActions");

// CCIP chain selector for Ethereum mainnet (Chainlink CCIP docs).
const CCIP_CHAIN_SELECTOR_MAINNET = "5009297550715157269";

// Default per-receive destination gas limit for cross-chain message handling.
const DEFAULT_DEST_GAS_LIMIT = 500000;

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

    // --- 2. Initialise the strategy proxy: set impl, governor=timelock, call initialize(operator) ---
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
    // Under CREATE3 parity, the peer adapter address on Ethereum equals these adapters'
    // own addresses. No peer-receiver field — adapters hard-code `address(this)`.
    //
    // ChainConfig fields: { paused, chainSelector, destGasLimit }
    const masterChainCfg = {
      paused: false,
      chainSelector: CCIP_CHAIN_SELECTOR_MAINNET,
      destGasLimit: DEFAULT_DEST_GAS_LIMIT,
    };
    await withConfirmation(
      dCCIPOutbound
        .connect(sDeployer)
        .authorise(masterProxyAddress, masterChainCfg)
    );
    await withConfirmation(
      dSuperRx.connect(sDeployer).authorise(masterProxyAddress, masterChainCfg)
    );
    // Strategist (multichain strategist) can pause/unpause lanes for fast incident response.
    await withConfirmation(
      dCCIPOutbound
        .connect(sDeployer)
        .addStrategist(addresses.multichainStrategist)
    );
    await withConfirmation(
      dSuperRx.connect(sDeployer).addStrategist(addresses.multichainStrategist)
    );

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
      ],
    };
  }
);

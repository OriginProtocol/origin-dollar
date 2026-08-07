const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const {
  getCreate2ProxyAddress,
  deployProxyWithCreateX,
} = require("../deployActions");

// Default per-receive destination gas limit for cross-chain message handling.
const DEFAULT_DEST_GAS_LIMIT = 500000;

// CreateX/CREATE2 salts for the adapter proxies. MUST match the Ethereum-side salts used
// in `deploy/mainnet/211_oethb_v3_remote_impl.js` so the proxy addresses are
// identical across chains (peer-parity requirement on the
// `transportSender == address(this)` check).
const CCIP_ADAPTER_PROXY_SALT = "OETHb V3 CCIPAdapter Proxy 1";
const SUPERBRIDGE_ADAPTER_PROXY_SALT = "OETHb V3 SuperbridgeAdapter Proxy 1";

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

    // --- 3. Deploy adapter impls (plain; chain-specific args baked into bytecode) ---
    //
    // Adapters live behind `BridgeAdapterProxy` (CreateX/CREATE2 → identical address on both
    // chains, mandatory for the `transportSender == address(this)` peer-parity check).
    // The impls are deployed plain — their addresses differ across chains but only the
    // proxy is part of the parity check.
    //
    // Outbound (B→E): CCIPAdapter
    await deployWithConfirmation("CCIPAdapter", [addresses.base.CCIPRouter]);
    const dCCIPImpl = await ethers.getContract("CCIPAdapter");
    console.log(`CCIPAdapter impl: ${dCCIPImpl.address}`);

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
    const dSuperImpl = await ethers.getContract("SuperbridgeAdapter");
    console.log(`SuperbridgeAdapter impl: ${dSuperImpl.address}`);

    // --- 4. Deploy adapter proxies via CreateX/CREATE2 ---
    const ccipProxyAddr = await deployProxyWithCreateX(
      CCIP_ADAPTER_PROXY_SALT,
      "BridgeAdapterProxy",
      false,
      null,
      "OETHbV3CCIPAdapterProxy"
    );
    console.log(`CCIPAdapter proxy: ${ccipProxyAddr}`);
    const superProxyAddr = await deployProxyWithCreateX(
      SUPERBRIDGE_ADAPTER_PROXY_SALT,
      "BridgeAdapterProxy",
      false,
      null,
      "OETHbV3SuperbridgeAdapterProxy"
    );
    console.log(`SuperbridgeAdapter proxy: ${superProxyAddr}`);

    // --- 5. Initialise adapter proxies to point at impls. Proxy constructor set
    //         governor = deployer; `initialize` is onlyGovernor and re-asserts governor.
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

    // After this, the proxy address is the "real" adapter — configure it as such.
    const dCCIPOutbound = await ethers.getContractAt(
      "CCIPAdapter",
      ccipProxyAddr
    );
    const dSuperRx = await ethers.getContractAt(
      "SuperbridgeAdapter",
      superProxyAddr
    );

    // --- 6. Adapter configuration (deployer is governor here, so do it now) ---
    //
    // ChainConfig fields: { paused, chainSelector, destGasLimit }
    const masterChainCfg = {
      paused: false,
      chainSelector: addresses.mainnet.CCIPChainSelector,
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

    // --- 7. Transfer adapter proxy governance to Base timelock ---
    await withConfirmation(
      dCCIPOutbound
        .connect(sDeployer)
        .transferGovernance(addresses.base.timelock)
    );
    await withConfirmation(
      dSuperRx.connect(sDeployer).transferGovernance(addresses.base.timelock)
    );

    // --- 8. Resolve Master as IStrategy / IGovernable for the governance actions ---
    const cMaster = await ethers.getContractAt(
      "MasterWOTokenStrategy",
      masterProxyAddress
    );

    return {
      name: "Deploy OETHb V3 Master strategy + adapters on Base",
      actions: [
        // Timelock claims governance on the two adapter proxies.
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
        // Wire the adapter PROXY addresses into Master (governor-gated on Master).
        {
          contract: cMaster,
          signature: "setOutboundAdapter(address)",
          args: [ccipProxyAddr],
        },
        {
          contract: cMaster,
          signature: "setInboundAdapter(address)",
          args: [superProxyAddr],
        },
      ],
    };
  }
);

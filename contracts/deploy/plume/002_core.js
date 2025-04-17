const { deployOnPlume } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { parseUnits } = require("ethers/lib/utils.js");

module.exports = deployOnPlume(
  {
    deployName: "002_core",
  },
  async () => {
    const { deployerAddr, strategistAddr, timelockAddr } =
      await getNamedAccounts();

    const sDeployer = await ethers.getSigner(deployerAddr);

    // Deploy Oracle Router
    await deployWithConfirmation("OETHFixedOracle", []);
    const cOracleRouter = await ethers.getContract("OETHFixedOracle");

    console.log("OETHFixedOracle deployed at", cOracleRouter.address);

    // Proxies
    await deployWithConfirmation("OETHPlumeProxy");
    await deployWithConfirmation("WOETHPlumeProxy");
    await deployWithConfirmation("OETHPlumeVaultProxy");

    console.log("Proxies deployed");

    const cOETHpProxy = await ethers.getContract("OETHPlumeProxy");
    const cwOETHpProxy = await ethers.getContract("WOETHPlumeProxy");
    const cOETHpVaultProxy = await ethers.getContract("OETHPlumeVaultProxy");

    // Core contracts
    const dOETHp = await deployWithConfirmation("OETHPlume");
    console.log("OETHPlume deployed at", dOETHp.address);
    const dwOETHp = await deployWithConfirmation("WOETHPlume", [
      cOETHpProxy.address, // Plume token
    ]);
    console.log("WOETHPlume deployed at", dwOETHp.address);
    const dOETHpVault = await deployWithConfirmation("OETHVault");
    console.log("OETHVault deployed at", dOETHpVault.address);
    const dOETHpVaultCore = await deployWithConfirmation("OETHBaseVaultCore", [
      addresses.plume.WETH,
    ]);
    const dOETHpVaultAdmin = await deployWithConfirmation(
      "OETHBaseVaultAdmin",
      [addresses.plume.WETH]
    );
    console.log("OETHBaseVaultAdmin deployed at", dOETHpVaultAdmin.address);
    // Get contract instances
    const cOETHp = await ethers.getContractAt("OETHPlume", cOETHpProxy.address);
    const cwOETHp = await ethers.getContractAt(
      "WOETHPlume",
      cwOETHpProxy.address
    );
    const cOETHpVault = await ethers.getContractAt(
      "IVault",
      cOETHpVaultProxy.address
    );

    // Init OETHp
    const resolution = ethers.utils.parseUnits("1", 27);
    const initDataOETHp = cOETHp.interface.encodeFunctionData(
      "initialize(address,uint256)",
      [
        cOETHpVaultProxy.address, // OETHp Vault
        resolution, // HighRes
      ]
    );
    // prettier-ignore
    await withConfirmation(
      cOETHpProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dOETHp.address,
          deployerAddr,
          initDataOETHp
        )
    );
    console.log("Initialized OETHPlumeProxy and OETHPlume implementation");

    // Init OETHpVault
    const initDataOETHpVault = cOETHpVault.interface.encodeFunctionData(
      "initialize(address,address)",
      [
        cOracleRouter.address, // OracleRouter
        cOETHpProxy.address, // OETHp
      ]
    );
    // prettier-ignore
    await withConfirmation(
      cOETHpVaultProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dOETHpVault.address,
          deployerAddr,
          initDataOETHpVault
        )
    );
    console.log(
      "Initialized OETHPlumeVaultProxy and OETHPlumeVault implementation"
    );

    // Init wOETHp
    const initDatawOETHp = cwOETHp.interface.encodeFunctionData(
      "initialize()",
      []
    );
    // prettier-ignore
    await withConfirmation(
      cwOETHpProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dwOETHp.address,
          timelockAddr,
          initDatawOETHp
        )
    );
    console.log("Initialized WOETHPlumeProxy and WOETHPlume implementation");

    // Transfer governance to Timelock
    await withConfirmation(
      cOETHpProxy.connect(sDeployer).transferGovernance(timelockAddr)
    );
    await withConfirmation(
      cOETHpVaultProxy.connect(sDeployer).transferGovernance(timelockAddr)
    );
    console.log("Transferred governance to Timelock");

    return {
      actions: [
        {
          // Claim governance on OETHp
          contract: cOETHpProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          // Claim governance on Vault
          contract: cOETHpVaultProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          // Set VaultCore implementation
          contract: cOETHpVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHpVaultCore.address],
        },
        {
          // Set VaultAdmin implementation
          contract: cOETHpVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHpVaultAdmin.address],
        },
        {
          // Allow minting with WETH
          contract: cOETHpVault,
          signature: "supportAsset(address,uint8)",
          args: [addresses.plume.WETH, 0],
        },
        {
          // Unpause Capital
          contract: cOETHpVault,
          signature: "unpauseCapital()",
          args: [],
        },
        {
          // Set async claim delay
          contract: cOETHpVault,
          signature: "setWithdrawalClaimDelay(uint256)",
          args: [24 * 60 * 60],
        },
        {
          // Set rebase threshold
          contract: cOETHpVault,
          signature: "setRebaseThreshold(uint256)",
          args: [parseUnits("1", 18)], // 1 OETHp
        },
        {
          // Set strategist
          contract: cOETHpVault,
          signature: "setStrategistAddr(address)",
          args: [strategistAddr],
        },
        {
          // Set max supply diff
          contract: cOETHpVault,
          signature: "setMaxSupplyDiff(uint256)",
          args: [parseUnits("1", 18)], // 1 OETHp
        },
        // NOTE: Following two can be set by 2/8
        // {
        //   // Set drip duration
        //   contract: cOETHpVault,
        //   signature: "setDripDuration(uint256)",
        //   args: [7 * 24 * 60 * 60], // 1 week
        // },
        // {
        //   // Set max rebase rate
        //   contract: cOETHpVault,
        //   signature: "setRebaseRateMax(uint256)",
        //   args: [parseUnits("10", 18)], // 10%
        // },
      ],
    };
  }
);

const { deployOnPlume } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnPlume(
  {
    deployName: "002_core",
    onlyOnFork: true,
  },
  async () => {
    const { deployerAddr } = await getNamedAccounts();

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
    const dOETHpVaultAdmin = await deployWithConfirmation("OETHBaseVaultAdmin");
    console.log("OETHBaseVaultAdmin deployed at", dOETHpVaultAdmin.address);
    // Get contract instances
    const cOETHp = await ethers.getContractAt("OETHPlume", cOETHpProxy.address);
    // const cwOETHp = await ethers.getContractAt(
    //   "WOETHPlume",
    //   cwOETHpProxy.address
    // );
    const cOETHpVault = await ethers.getContractAt(
      "OETHVault",
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

    // TODO: Fix this
    // // Init wOETHp
    // const initDatawOETHp = cwOETHp.interface.encodeFunctionData(
    //   "initialize()",
    //   []
    // );
    // prettier-ignore
    await withConfirmation(
    cwOETHpProxy
      .connect(sDeployer)["initialize(address,address,bytes)"](
        dwOETHp.address,
        // No need for additional governance transfer,
        // since deployer doesn't have to configure anything
        deployerAddr,
        "0x"
      )
  );
    console.log("Initialized WOETHPlumeProxy and WOETHPlume implementation");

    // Set Core Impl
    await withConfirmation(
      cOETHpVaultProxy.connect(sDeployer).upgradeTo(dOETHpVaultCore.address)
    );
    console.log("Set OETHPlumeVaultCore implementation");

    // Set Admin Impl
    await withConfirmation(
      cOETHpVault.connect(sDeployer).setAdminImpl(dOETHpVaultAdmin.address)
    );
    console.log("Set OETHPlumeVaultAdmin implementation");

    // TODO: Move to governance actions later
    // 1. Allow minting with WETH
    await withConfirmation(
      cOETHpVault.connect(sDeployer).supportAsset(addresses.plume.WETH, 0)
    );
    console.log("Allowed minting with WETH");
    // 2. Unpause Capital
    await withConfirmation(cOETHpVault.connect(sDeployer).unpauseCapital());
    console.log("Unpaused Capital");

    // 3. Set async claim delay to 1 day
    await withConfirmation(
      cOETHpVault.connect(sDeployer).setWithdrawalClaimDelay(24 * 60 * 60)
    );
    console.log("Set async claim delay to 1 day");

    // TODO: Call this after minting some OETHp

    // await withConfirmation(
    //   cwOETHp.connect(sDeployer)["initialize()"]()
    // );
    // console.log("Initialized WOETHPlume");

    return {
      // No Governance actions for now
      actions: [],
    };
  }
);

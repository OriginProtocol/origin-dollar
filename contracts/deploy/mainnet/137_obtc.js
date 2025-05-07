const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { parseUnits } = require("ethers/lib/utils");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "137_obtc",
    forceDeploy: false,
    // forceSkip: true,
    deployerIsProposer: false,
    // proposalId: "",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    const { deployerAddr, strategistAddr, timelockAddr } =
      await getNamedAccounts();

    const sDeployer = await ethers.getSigner(deployerAddr);

    // Deploy Oracle Router
    await deployWithConfirmation("OETHFixedOracle", []);
    const cOracleRouter = await ethers.getContract("OETHFixedOracle");

    // Deploy proxies
    await deployWithConfirmation("OBTCProxy");
    const cOBTCProxy = await ethers.getContract("OBTCProxy");
    await deployWithConfirmation("WOBTCProxy");
    const cWOBTCProxy = await ethers.getContract("WOBTCProxy");
    await deployWithConfirmation("OBTCVaultProxy");
    const cOBTCVaultProxy = await ethers.getContract("OBTCVaultProxy");

    // Temp Dripper
    const dTempDripper = await deployWithConfirmation("FixedRateDripper", [
      cOBTCVaultProxy.address,
      addresses.mainnet.WBTC,
    ]);
    console.log("FixedRateDripper deployed at", dTempDripper.address);

    // Deploy core contracts
    const dOBTC = await deployWithConfirmation("OBTC");
    const dwOBTC = await deployWithConfirmation("WOBTC", [cOBTCProxy.address]);
    const dOBTCVaultCore = await deployWithConfirmation("OBTCVaultCore", [
      addresses.mainnet.WBTC,
    ]);
    const cOBTCVaultCore = await ethers.getContract("OBTCVaultCore");
    const dOBTCVaultAdmin = await deployWithConfirmation("OBTCVaultAdmin", [
      addresses.mainnet.WBTC,
    ]);

    // Get contract instances
    const cOBTC = await ethers.getContractAt("OBTC", cOBTCProxy.address);
    const cwOBTC = await ethers.getContractAt("WOBTC", cWOBTCProxy.address);
    const cOBTCVault = await ethers.getContractAt(
      "IVault",
      cOBTCVaultProxy.address
    );

    // Init OBTC
    const resolution = ethers.utils.parseUnits("1", 27);
    const initDataOBTC = cOBTC.interface.encodeFunctionData(
      "initialize(address,uint256)",
      [cOBTCVaultProxy.address, resolution]
    );
    // prettier-ignore
    await withConfirmation(
      cOBTCProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dOBTC.address,
          timelockAddr,
          initDataOBTC
        )
    );
    console.log("Initialized OBTCProxy and OBTC implementation");

    // Init OBTCVault
    const initDataOBTCVault = cOBTCVaultCore.interface.encodeFunctionData(
      "initialize(address,address)",
      [cOracleRouter.address, cOBTCProxy.address]
    );
    // prettier-ignore
    await withConfirmation(
      cOBTCVaultProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dOBTCVaultCore.address,
          timelockAddr,
          initDataOBTCVault
        )
    );
    console.log("Initialized OBTCVault");

    // Init wOBTC
    const initDatawOBTC = cwOBTC.interface.encodeFunctionData(
      "initialize()",
      []
    );
    // prettier-ignore
    await withConfirmation(
      cWOBTCProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dwOBTC.address,
          timelockAddr,
          initDatawOBTC
        )
    );
    console.log("Initialized wOBTC");

    return {
      name: "Deploy OBTC",
      actions: [
        {
          // Set VaultCore implementation
          contract: cOBTCVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOBTCVaultCore.address],
        },
        {
          // Set VaultAdmin implementation
          contract: cOBTCVault,
          signature: "setAdminImpl(address)",
          args: [dOBTCVaultAdmin.address],
        },
        {
          // Allow minting with WBTC
          contract: cOBTCVault,
          signature: "supportAsset(address,uint8)",
          args: [addresses.mainnet.WBTC, 0],
        },
        {
          // Unpause Capital
          contract: cOBTCVault,
          signature: "unpauseCapital()",
          args: [],
        },
        {
          // Set async claim delay
          contract: cOBTCVault,
          signature: "setWithdrawalClaimDelay(uint256)",
          args: [24 * 60 * 60],
        },
        {
          // Set rebase threshold
          contract: cOBTCVault,
          signature: "setRebaseThreshold(uint256)",
          args: [parseUnits("0.01", 18)], // 0.01 wBTC
        },
        {
          // Set strategist
          contract: cOBTCVault,
          signature: "setStrategistAddr(address)",
          args: [strategistAddr],
        },
        {
          // Set max supply diff
          contract: cOBTCVault,
          signature: "setMaxSupplyDiff(uint256)",
          args: [parseUnits("1", 18)], // 1 wBTC
        },
        {
          // Set dripper
          contract: cOBTCVault,
          signature: "setDripper(address)",
          args: [dTempDripper.address],
        },
        {
          // Set drip duration
          contract: cOBTCVault,
          signature: "setDripDuration(uint256)",
          args: [7 * 24 * 60 * 60], // 1 week
        },
        {
          // Set max rebase rate
          contract: cOBTCVault,
          signature: "setRebaseRateMax(uint256)",
          args: [parseUnits("10", 18)], // 10%
        },
      ],
    };
  }
);

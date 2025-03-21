const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { oethUnits } = require("../../test/helpers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "129_ousd_curve_amo",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId: "",
  },
  async ({ ethers }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cOracleRouter = await ethers.getContract("OracleRouter");
    await cOracleRouter.cacheDecimals(addresses.mainnet.USDT);

    // Deploy Base Curve AMO proxy
    const cOUSDProxy = await ethers.getContract("OUSDProxy");
    const cOUSDVaultProxy = await ethers.getContract("VaultProxy");
    const cOUSDVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cOUSDVaultProxy.address
    );

    const dOUSDCurveAMOProxy = await deployWithConfirmation(
      "OUSDCurveAMOProxy",
      []
    );

    const cOUSDCurveAMOProxy = await ethers.getContractAt(
      "OUSDCurveAMOProxy",
      dOUSDCurveAMOProxy.address
    );

    // Deploy Base Curve AMO implementation
    const dOUSDCurveAMO = await deployWithConfirmation("OUSDCurveAMOStrategy", [
      [addresses.mainnet.CurveOUSDUSDTPool, cOUSDVaultProxy.address],
      cOUSDProxy.address,
      addresses.mainnet.USDT,
      addresses.mainnet.CurveOUSDUSDTGauge,
      addresses.mainnet.CRVMinter,
      0,
      1,
    ]);
    const cOUSDCurveAMOImpl = await ethers.getContract("OUSDCurveAMOStrategy");

    // Initialize Base Curve AMO implementation
    const initData = cOUSDCurveAMOImpl.interface.encodeFunctionData(
      "initialize(address[],uint256)",
      [[addresses.mainnet.CRV], oethUnits("0.002")]
    );

    await withConfirmation(
      // prettier-ignore
      cOUSDCurveAMOProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dOUSDCurveAMO.address,
          addresses.mainnet.Timelock,
          initData
        )
    );

    console.log("Vault Admin: ", cOUSDVaultAdmin.address);

    return {
      name: "Add Curve AMO Strategy to OUSD Vault",
      actions: [
        // Approve strategy on vault
        {
          contract: cOUSDVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cOUSDCurveAMOProxy.address],
        },
        // Add strategyb to mint whitelist
        {
          contract: cOUSDVaultAdmin,
          signature: "setOusdMetaStrategy(address)",
          args: [cOUSDCurveAMOProxy.address],
        },
      ],
    };
  }
);

const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { oethUnits } = require("../../test/helpers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "131_ousd_usdc_curve_amo",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "25500112647750821066059988048824352945507970558859648817105366239943827337543",
  },
  async ({ ethers }) => {
    const { deployerAddr, strategistAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cOracleRouter = await ethers.getContract("OracleRouter");
    await cOracleRouter.cacheDecimals(addresses.mainnet.USDT);
    await cOracleRouter.cacheDecimals(addresses.mainnet.USDC);

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
    const dOUSDCurveAMO = await deployWithConfirmation("CurveAMOStrategy", [
      [addresses.mainnet.curve.OUSD_USDC.pool, cOUSDVaultProxy.address],
      cOUSDProxy.address,
      addresses.mainnet.USDC,
      addresses.mainnet.curve.OUSD_USDC.gauge,
      addresses.mainnet.CRVMinter,
    ]);
    const cOUSDCurveAMOImpl = await ethers.getContract("CurveAMOStrategy");

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

    const cOUSDCurveAMO = await ethers.getContractAt(
      "CurveAMOStrategy",
      cOUSDCurveAMOProxy.address
    );

    return {
      name: "Add Curve AMO Strategy to OUSD Vault",
      actions: [
        // Approve strategy on vault
        {
          contract: cOUSDVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cOUSDCurveAMOProxy.address],
        },
        // Add strategy to mint whitelist
        {
          contract: cOUSDVaultAdmin,
          signature: "setOusdMetaStrategy(address)",
          args: [cOUSDCurveAMOProxy.address],
        },
        // Set strategist as harvester
        {
          contract: cOUSDCurveAMO,
          signature: "setHarvesterAddress(address)",
          args: [strategistAddr],
        },
      ],
    };
  }
);

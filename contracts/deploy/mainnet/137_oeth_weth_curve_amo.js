const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { oethUnits } = require("../../test/helpers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "137_oeth_weth_curve_amo",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "56250259650123444799492076755994707271232704725960146040626637955232036241797",
  },
  async ({ ethers }) => {
    const { deployerAddr, strategistAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cOETHProxy = await ethers.getContract("OETHProxy");
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHVaultAdmin = await ethers.getContractAt(
      "OETHVaultAdmin",
      cOETHVaultProxy.address
    );

    // Deploy Base Curve AMO proxy
    const dOETHCurveAMOProxy = await deployWithConfirmation(
      "OETHCurveAMOProxy",
      []
    );

    const cOETHCurveAMOProxy = await ethers.getContractAt(
      "OETHCurveAMOProxy",
      dOETHCurveAMOProxy.address
    );

    // Deploy Base Curve AMO implementation
    const dOETHCurveAMO = await deployWithConfirmation("CurveAMOStrategy", [
      [addresses.mainnet.curve.OETH_WETH.pool, cOETHVaultProxy.address],
      cOETHProxy.address,
      addresses.mainnet.WETH,
      addresses.mainnet.curve.OETH_WETH.gauge,
      addresses.mainnet.CRVMinter,
    ]);
    const cOETHCurveAMOImpl = await ethers.getContract("CurveAMOStrategy");

    // Initialize Base Curve AMO implementation
    const initData = cOETHCurveAMOImpl.interface.encodeFunctionData(
      "initialize(address[],uint256)",
      [[addresses.mainnet.CRV], oethUnits("0.002")]
    );

    await withConfirmation(
      // prettier-ignore
      cOETHCurveAMOProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dOETHCurveAMO.address,
          addresses.mainnet.Timelock,
          initData
        )
    );

    const cOETHCurveAMO = await ethers.getContractAt(
      "CurveAMOStrategy",
      cOETHCurveAMOProxy.address
    );

    return {
      name: "Add new Curve AMO Strategy to OETH Vault",
      actions: [
        // Approve strategy on vault
        {
          contract: cOETHVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cOETHCurveAMOProxy.address],
        },
        // Add strategy to mint whitelist
        {
          contract: cOETHVaultAdmin,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cOETHCurveAMOProxy.address],
        },
        // Set strategist as harvester
        {
          contract: cOETHCurveAMO,
          signature: "setHarvesterAddress(address)",
          args: [strategistAddr],
        },
      ],
    };
  }
);

const { deployOnBaseWithGuardian } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBaseWithGuardian(
  {
    deployName: "022_base_curve_amo",
  },
  async ({ ethers }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Deploy Base Curve AMO proxy
    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHbVaultAdmin = await ethers.getContractAt(
      "OETHBaseVaultAdmin",
      cOETHbVaultProxy.address
    );

    const dOETHBaseCurveAMOProxy = await deployWithConfirmation(
      "OETHBaseCurveAMOProxy",
      []
    );

    const cOETHBaseCurveAMOProxy = await ethers.getContract(
      "OETHBaseCurveAMOProxy"
    );

    // Deploy Base Curve AMO implementation
    const dOETHBaseCurveAMO = await deployWithConfirmation(
      "BaseCurveAMOStrategy",
      [
        [addresses.base.OETHb_WETH.pool, cOETHbVaultProxy.address],
        cOETHbProxy.address,
        addresses.base.WETH,
        addresses.base.OETHb_WETH.gauge,
        addresses.base.childLiquidityGaugeFactory,
      ]
    );
    const cOETHBaseCurveAMO = await ethers.getContractAt(
      "BaseCurveAMOStrategy",
      dOETHBaseCurveAMOProxy.address
    );

    // Initialize Base Curve AMO implementation
    const initData = cOETHBaseCurveAMO.interface.encodeFunctionData(
      "initialize(address[],address[])",
      [[addresses.base.CRV], [addresses.base.WETH]]
    );
    await withConfirmation(
      // prettier-ignore
      cOETHBaseCurveAMOProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dOETHBaseCurveAMO.address,
          governorAddr,
          initData
        )
    );

    return {
      actions: [
        // Approve strategy on vault
        {
          contract: cOETHbVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cOETHBaseCurveAMOProxy.address],
        },
        // Add strategyb to mint whitelist
        {
          contract: cOETHbVaultAdmin,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cOETHBaseCurveAMOProxy.address],
        },
      ],
    };
  }
);

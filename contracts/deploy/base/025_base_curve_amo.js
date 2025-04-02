const { deployOnBase } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { oethUnits } = require("../../test/helpers");

module.exports = deployOnBase(
  {
    deployName: "025_base_curve_amo",
  },
  async ({ ethers }) => {
    const { deployerAddr } = await getNamedAccounts();
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
        1, // SuperOETH is coin 1 of the Curve WETH/SuperOETH pool
        0, // WETH is coin 0 of the Curve WETH/SuperOETH pool
      ]
    );
    const cOETHBaseCurveAMO = await ethers.getContractAt(
      "BaseCurveAMOStrategy",
      dOETHBaseCurveAMOProxy.address
    );

    // Initialize Base Curve AMO implementation
    const initData = cOETHBaseCurveAMO.interface.encodeFunctionData(
      "initialize(address[],uint256)",
      [[addresses.base.CRV], oethUnits("0.002")]
    );
    await withConfirmation(
      // prettier-ignore
      cOETHBaseCurveAMOProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dOETHBaseCurveAMO.address,
          addresses.base.timelock,
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
        // Add strategy to mint whitelist
        {
          contract: cOETHbVaultAdmin,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cOETHBaseCurveAMOProxy.address],
        },
      ],
    };
  }
);

const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "027_base_curve_amo_upgrade",
  },
  async ({ ethers }) => {
    // Deploy Base Curve AMO proxy
    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");

    const cOETHBaseCurveAMOProxy = await ethers.getContract(
      "OETHBaseCurveAMOProxy"
    );

    // Deploy Base Curve AMO implementation
    const dOETHBaseCurveAMOImpl = await deployWithConfirmation(
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

    return {
      actions: [
        // Upgrade the Base Curve AMO Strategy implementation
        {
          contract: cOETHBaseCurveAMOProxy,
          signature: "upgradeTo(address)",
          args: [dOETHBaseCurveAMOImpl.address],
        },
      ],
    };
  }
);

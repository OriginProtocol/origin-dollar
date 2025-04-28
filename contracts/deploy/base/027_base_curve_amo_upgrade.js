const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "027_base_curve_amo_upgrade",
  },
  async ({ ethers }) => {
    // Get the SuperOETH, Vault and Curve AMO contracts
    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHbVault = await ethers.getContractAt(
      "IVault",
      cOETHbVaultProxy.address
    );
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

    // Deploy new Vault Core implementation
    const dOETHbVaultCore = await deployWithConfirmation("OETHBaseVaultCore", [
      addresses.base.WETH,
    ]);

    // Deploy new Vault Admin implementation
    const dOETHbVaultAdmin = await deployWithConfirmation(
      "OETHBaseVaultAdmin",
      [addresses.base.WETH]
    );

    return {
      actions: [
        // 1. Upgrade the Base Curve AMO Strategy implementation
        {
          contract: cOETHBaseCurveAMOProxy,
          signature: "upgradeTo(address)",
          args: [dOETHBaseCurveAMOImpl.address],
        },
        // 2. Upgrade VaultCore
        {
          contract: cOETHbVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHbVaultCore.address],
        },
        // 3. Upgrade VaultAdmin
        {
          contract: cOETHbVault,
          signature: "setAdminImpl(address)",
          args: [dOETHbVaultAdmin.address],
        },
      ],
    };
  }
);

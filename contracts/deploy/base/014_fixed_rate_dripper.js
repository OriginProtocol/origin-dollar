const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "014_fixed_rate_dripper",
  },
  async ({ ethers }) => {
    const cOETHbDripperProxy = await ethers.getContract("OETHBaseDripperProxy");
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");

    // Deploy new implementation
    const dOETHbDripper = await deployWithConfirmation("FixedRateDripper", [
      cOETHbVaultProxy.address,
      addresses.base.WETH,
    ]);

    return {
      actions: [
        {
          // 1. Upgrade Dripper
          contract: cOETHbDripperProxy,
          signature: "upgradeTo(address)",
          args: [dOETHbDripper.address],
        },
      ],
    };
  }
);

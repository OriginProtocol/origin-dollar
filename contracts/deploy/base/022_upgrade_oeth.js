const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");

module.exports = deployOnBase(
  {
    deployName: "022_upgrade_oeth",
    // forceSkip: true,
  },
  async ({ ethers }) => {
    const dOETHb = await deployWithConfirmation(
      "OETHBase",
      [],
      undefined,
      true
    );

    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");

    return {
      actions: [
        {
          // 1. Upgrade OETH
          contract: cOETHbProxy,
          signature: "upgradeTo(address)",
          args: [dOETHb.address],
        },
      ],
    };
  }
);

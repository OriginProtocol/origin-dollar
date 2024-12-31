const { deployOnBaseWithGuardian } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");

module.exports = deployOnBaseWithGuardian(
  {
    deployName: "021_upgrade_oeth",
    forceSkip: false
  },
  async ({ ethers }) => {
    const dOETHb = await deployWithConfirmation("OETHBase");

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

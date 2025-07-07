const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");

module.exports = deployOnBase(
  {
    deployName: "036_oethb_upgrade_EIP7702",
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

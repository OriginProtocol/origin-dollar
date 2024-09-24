const { deployOnBaseWithGuardian } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBaseWithGuardian(
  {
    deployName: "014_upgrade_oethb",
  },
  async ({ ethers }) => {
    // Proxy
    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");

    // Deploy implementation
    const dOETHb = await deployWithConfirmation("OETHBase");

    return {
      actions: [
        {
          // 1. Upgrade OETHb proxy
          contract: cOETHbProxy,
          signature: "upgradeTo(address)",
          args: [dOETHb.address],
        },
      ],
    };
  }
);

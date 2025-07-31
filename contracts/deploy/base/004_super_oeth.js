const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");

module.exports = deployOnBase(
  {
    deployName: "004_super_oeth",
  },
  async ({ ethers }) => {
    // Proxies
    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");
    const cwOETHbProxy = await ethers.getContract("WOETHBaseProxy");

    // Core contracts
    const dOETHb = await deployWithConfirmation("OETHBase");
    const dwOETHb = await deployWithConfirmation("WOETHBase", [
      cOETHbProxy.address, // Base token
    ]);

    // Get contract instances
    const cOETHb = await ethers.getContractAt("OETHBase", cOETHbProxy.address);

    return {
      actions: [
        {
          // 1. Upgrade OETHb proxy
          contract: cOETHbProxy,
          signature: "upgradeTo(address)",
          args: [dOETHb.address],
        },
        {
          // 2. Initialize OETHb's new impl
          contract: cOETHb,
          signature: "initialize2()",
          args: [],
        },
        {
          // 3. Upgrade wOETHb proxy
          contract: cwOETHbProxy,
          signature: "upgradeTo(address)",
          args: [dwOETHb.address],
        },
      ],
    };
  }
);

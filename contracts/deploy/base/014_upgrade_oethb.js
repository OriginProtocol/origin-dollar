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
    const cOETHb = await ethers.getContractAt("OETHBase", cOETHbProxy.address);
    
    // Deploy implementation
    const dOETHb = await deployWithConfirmation("OETHBase");

    const existingImpl = await cOETHbProxy.implementation();

    return {
      actions: [
        {
          // 1. Upgrade OETHb proxy
          contract: cOETHbProxy,
          signature: "upgradeTo(address)",
          args: [dOETHb.address],
        },
        {
          // 2. Recover funds from bribes contract
          contract: cOETHb,
          signature: "governanceTransfer(address,address)",
          args: [addresses.base.oethbBribesContract, addresses.base.strategist],
        },
        {
          // 3. Revert back OETHb implementation
          contract: cOETHbProxy,
          signature: "upgradeTo(address)",
          args: [existingImpl],
        },
      ],
    };
  }
);

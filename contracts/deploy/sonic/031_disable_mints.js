const { deployOnSonic } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "031_disable_mints",
  },
  async ({ ethers }) => {
    const dOSonicVault = await deployWithConfirmation(
      "OSVault",
      [addresses.sonic.wS],
      "OSVault",
      true
    );

    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");

    return {
      name: "Upgrade OSonicVault to disable public mints",
      actions: [
        {
          contract: cOSonicVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOSonicVault.address],
        },
      ],
    };
  }
);

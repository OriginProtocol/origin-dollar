const addresses = require("../../utils/addresses");
const { deployOnSonic } = require("../../utils/deploy-l2.js");

module.exports = deployOnSonic(
  {
    deployName: "012_dripper_no_donate",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    // Contract addresses to use
    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");
    const cWS = await ethers.getContractAt("IWrappedSonic", addresses.sonic.wS);

    // Deploy
    const dOSonicVaultCore = await deployWithConfirmation("OSonicVaultCore", [
      cWS.address,
    ]);
    console.log(`Deployed Vault Core to ${dOSonicVaultCore.address}`);

    const dOSonicVaultAdmin = await deployWithConfirmation("OSonicVaultAdmin", [
      cWS.address,
    ]);
    console.log(`Deployed Vault Admin to ${dOSonicVaultAdmin.address}`);

    // Get vault contract instance
    const cOSonicVault = await ethers.getContractAt(
      "IVault",
      cOSonicVaultProxy.address
    );

    // ----------------
    // Governance Actions
    // ----------------
    return {
      name: "Add rate limiting to Origin Sonic Vault",
      actions: [
        // 1. Upgrade Vault proxy to VaultCore
        {
          contract: cOSonicVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOSonicVaultCore.address],
        },
        // 2. Set the VaultAdmin
        {
          contract: cOSonicVault,
          signature: "setAdminImpl(address)",
          args: [dOSonicVaultAdmin.address],
        },
      ],
    };
  }
);

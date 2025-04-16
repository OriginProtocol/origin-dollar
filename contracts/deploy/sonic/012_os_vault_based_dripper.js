const { parseUnits } = require("ethers/lib/utils.js");
const addresses = require("../../utils/addresses");
const { deployOnSonic } = require("../../utils/deploy-l2.js");

module.exports = deployOnSonic(
  {
    deployName: "012_dripper_no_donate",
  },
  async ({ deployWithConfirmation }) => {
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
        // 3. Default to a short dripper, since currently we are running zero dripper.
        {
          contract: cOSonicVault,
          signature: "setDripDuration(uint256)",
          args: [4 * 60 * 60],
        },
        // 4. Default to a 20% APR rebase rate cap
        {
          contract: cOSonicVault,
          signature: "setRebaseRateMax(uint256)",
          args: [parseUnits("20", 18)],
        },
      ],
    };
  }
);

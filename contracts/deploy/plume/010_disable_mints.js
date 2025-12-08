const { deployOnPlume } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnPlume(
  {
    deployName: "010_disable_mints",
    //proposalId: "",
  },
  async ({ ethers }) => {
    const cOETHpVaultProxy = await ethers.getContract("OETHPlumeVaultProxy");

    // Deploy new implementation to disable mints
    const dOETHpVaultCore = await deployWithConfirmation("OETHPlumeVaultCore", [
      addresses.plume.WETH,
    ]);

    // ----------------
    // Governance Actions
    // ----------------
    return {
      name: "Upgrade VaultCore to disable mints",
      actions: [
        // 1. Upgrade VaultCore implementation
        {
          contract: cOETHpVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHpVaultCore.address],
        },
      ],
    };
  }
);

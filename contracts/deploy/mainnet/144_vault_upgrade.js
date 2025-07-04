const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "144_vault_upgrade",
    //proposalId: "",
  },
  async ({ ethers }) => {
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHHarvesterSimpleProxy = await ethers.getContract(
      "OETHSimpleHarvesterProxy"
    );

    const cOETHHarvesterSimple = await ethers.getContractAt(
      "OETHHarvesterSimple",
      cOETHHarvesterSimpleProxy.address
    );

    // Deploy new implementation without storage slot checks because of the: 
    // - Renamed `dripper` to `_deprecated_dripper`
    const dOETHVaultCore = await deployWithConfirmation("OETHVaultCore", [
      addresses.mainnet.WETH
    ], "OETHVaultCore", true);



    // ----------------
    // Governance Actions
    // ----------------
    return {
      name: "Upgrade VaultCore and set Vault as the recipient of the WETH rewards on the Simple harvester",
      actions: [
        // 1. Upgrade Vault proxy to VaultCore
        {
          contract: cOETHVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHVaultCore.address],
        },
        // 2. Move the WETH rewards from the Dripper directly to the Vault
        {
          contract: cOETHHarvesterSimple,
          signature: "setDripper(address)",
          args: [cOETHVaultProxy.address],
        }
      ],
    };
  }
);

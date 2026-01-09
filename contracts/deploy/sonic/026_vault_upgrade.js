const { deployOnSonic } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "026_vault_upgrade",
    //proposalId: "",
  },
  async ({ ethers }) => {
    // 1. Deploy new VaultCore and VaultAdmin implementations
    const dOSonicVaultCore = await deployWithConfirmation(
      "OSonicVaultCore",
      [addresses.sonic.wS],
      "OSonicVaultCore",
      true
    );

    const dOSonicVaultAdmin = await deployWithConfirmation(
      "OSonicVaultAdmin",
      [addresses.sonic.wS],
      "OSonicVaultAdmin",
      true
    );

    // 2. Connect to the OSonic Vault as its governor via the proxy
    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");
    const cOSonicVault = await ethers.getContractAt(
      "IVault",
      cOSonicVaultProxy.address
    );

    // 3. Connect to Sonic Staking Strategy
    const sonicStakingStrategy = await ethers.getContract(
      "SonicStakingStrategyProxy"
    );
    console.log(
      "Sonic Staking Strategy Address:",
      sonicStakingStrategy.address
    );

    // ----------------
    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OSonic Vault to new Core and Admin implementations",
      actions: [
        // 1. Upgrade VaultCore implementation
        {
          contract: cOSonicVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOSonicVaultCore.address],
        },
        // 2. Set VaultAdmin implementation
        {
          contract: cOSonicVault,
          signature: "setAdminImpl(address)",
          args: [dOSonicVaultAdmin.address],
        },
        // 3. Set Sonic Staking Strategy as default strategy
        {
          contract: cOSonicVault,
          signature: "setDefaultStrategy(address)",
          args: [sonicStakingStrategy.address],
        },
      ],
    };
  }
);

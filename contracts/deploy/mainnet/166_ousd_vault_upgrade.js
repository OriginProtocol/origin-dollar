const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "166_ousd_vault_upgrade",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy new OUSD Vault Core and Admin implementations
    const dVaultCore = await deployWithConfirmation("OUSDVaultCore", [
      addresses.mainnet.USDC,
    ]);
    const dVaultAdmin = await deployWithConfirmation("OUSDVaultAdmin", [
      addresses.mainnet.USDC,
    ]);

    // 2. Connect to the OUSD Vault as its governor via the proxy
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);

    // 3. Connect to the OUSD/USDC AMO
    const cOUSDAMO = await ethers.getContract("OUSDCurveAMOProxy");

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OUSD Vault to new Core and Admin implementations",
      actions: [
        // 1. Upgrade the OUSD Vault proxy to the new core vault implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        // 2. Set OUSD Vault proxy to the new admin vault implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        // 3. Add OUSD/USDC AMO to mint whitelist
        {
          contract: cVault,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cOUSDAMO.address],
        },
        // 4. Set OUSD/USDC AMO as default strategy
        {
          contract: cVault,
          signature: "setDefaultStrategy(address)",
          args: [cOUSDAMO.address],
        },
      ],
    };
  }
);

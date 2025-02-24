const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "108_vault_upgrade",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "65756708910242452493001228142964504430010766487241550114316648937729891405136",
  },
  async ({ deployWithConfirmation }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy new OETH Vault Core and Admin implementations
    const dVaultCore = await deployWithConfirmation("OETHVaultCore", [
      addresses.mainnet.WETH,
    ]);
    const dVaultAdmin = await deployWithConfirmation("OETHVaultAdmin", [
      addresses.mainnet.WETH,
    ]);

    // 2. Connect to the OETH Vault as its governor via the proxy
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);

    // 3. Deploy new OETH implementation without storage slot checks
    const dOETH = await deployWithConfirmation("OETH", [], "OETH", true);
    const cOETHProxy = await ethers.getContract("OETHProxy");

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OETH Vault",
      actions: [
        // 1. Upgrade the OETH Vault proxy to the new core vault implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        // 2. Set OETH Vault proxy to the new admin vault implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        // 3. Set async claim delay to 10 minutes
        {
          contract: cVault,
          signature: "setWithdrawalClaimDelay(uint256)",
          args: [10 * 60], // 10 mins
        },
        // 4. Upgrade the OETH proxy to the new implementation
        {
          contract: cOETHProxy,
          signature: "upgradeTo(address)",
          args: [dOETH.address],
        },
      ],
    };
  }
);

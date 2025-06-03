const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
} = require("../../utils/deploy");
const { parseUnits } = require("ethers/lib/utils.js");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "135_vault_wousd_upgrade",
    proposalId:
      "62736766423374672768580940310861921323283907575465980811344596309308068769219",
  },
  async ({ ethers }) => {
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cwOUSDProxy = await ethers.getContract("WrappedOUSDProxy");
    const cOUSDProxy = await ethers.getContract("OUSDProxy");

    const cOUSDVault = await ethers.getContractAt(
      "IVault",
      cVaultProxy.address
    );

    // Deploy new implementation
    const dOUSDVaultCore = await deployWithConfirmation("VaultCore", []);
    const dVaultAdmin = await deployWithConfirmation("VaultAdmin", []);

    const dwOUSD = await deployWithConfirmation("WrappedOusd", [
      cOUSDProxy.address, // OUSD token
    ]);

    const cwOUSD = await ethers.getContractAt(
      "WrappedOusd",
      cwOUSDProxy.address
    );

    // ----------------
    // Governance Actions
    // ----------------
    return {
      name: "Add rate limiting to Origin Vault and upgrade Wrapped OUSD",
      actions: [
        // 1. Upgrade Vault proxy to VaultCore
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOUSDVaultCore.address],
        },
        // 2. Set the VaultAdmin
        {
          contract: cOUSDVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        // 3. Default to a short dripper, since currently we are running zero dripper.
        {
          contract: cOUSDVault,
          signature: "setDripDuration(uint256)",
          args: [4 * 60 * 60],
        },
        // 4. Default to a 20% APR rebase rate cap
        {
          contract: cOUSDVault,
          signature: "setRebaseRateMax(uint256)",
          args: [parseUnits("20", 18)],
        },
        {
          // 5. Upgrade wOUSD proxy
          contract: cwOUSDProxy,
          signature: "upgradeTo(address)",
          args: [dwOUSD.address],
        },
        // 6. Run the second initializer
        {
          contract: cwOUSD,
          signature: "initialize2()",
          args: [],
        },
      ],
    };
  }
);

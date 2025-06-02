const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
} = require("../../utils/deploy");
const { parseUnits } = require("ethers/lib/utils.js");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "134_vault_woeth_upgrade",
    proposalId:
      "49172722703369984622112561793798089212723378488321724356488307408039828925801",
  },
  async ({ ethers }) => {
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cwOETHProxy = await ethers.getContract("WOETHProxy");
    const cOETHProxy = await ethers.getContract("OETHProxy");

    const cOETHVault = await ethers.getContractAt(
      "IVault",
      cOETHVaultProxy.address
    );

    // Deploy new implementation
    const dOETHVaultCore = await deployWithConfirmation("OETHVaultCore", [
      addresses.mainnet.WETH,
    ]);
    const dOETHVaultAdmin = await deployWithConfirmation("OETHVaultAdmin", [
      addresses.mainnet.WETH,
    ]);

    const dwOETH = await deployWithConfirmation("WOETH", [
      cOETHProxy.address, // OETH token
    ]);

    const cwOETH = await ethers.getContractAt("WOETH", cwOETHProxy.address);

    // ----------------
    // Governance Actions
    // ----------------
    return {
      name: "Add rate limiting to Origin Vault and upgrade WOETH",
      actions: [
        // 1. Upgrade Vault proxy to VaultCore
        {
          contract: cOETHVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHVaultCore.address],
        },
        // 2. Set the VaultAdmin
        {
          contract: cOETHVault,
          signature: "setAdminImpl(address)",
          args: [dOETHVaultAdmin.address],
        },
        // 3. Default to a short dripper, since currently we are running zero dripper.
        {
          contract: cOETHVault,
          signature: "setDripDuration(uint256)",
          args: [4 * 60 * 60],
        },
        // 4. Default to a 20% APR rebase rate cap
        {
          contract: cOETHVault,
          signature: "setRebaseRateMax(uint256)",
          args: [parseUnits("20", 18)],
        },
        {
          // 5. Upgrade wOETHb proxy
          contract: cwOETHProxy,
          signature: "upgradeTo(address)",
          args: [dwOETH.address],
        },
        // 6. Run the second initializer
        {
          contract: cwOETH,
          signature: "initialize2()",
          args: [],
        },
      ],
    };
  }
);

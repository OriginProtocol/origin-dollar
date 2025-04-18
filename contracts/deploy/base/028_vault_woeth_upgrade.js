const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const { parseUnits } = require("ethers/lib/utils.js");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "028_vault_woeth_upgrade",
  },
  async ({ ethers }) => {
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cwOETHbProxy = await ethers.getContract("WOETHBaseProxy");
    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");

    const cOETHbVault = await ethers.getContractAt(
      "IVault",
      cOETHbVaultProxy.address
    );

    // Deploy new implementation
    const dOETHbVaultCore = await deployWithConfirmation("OETHBaseVaultCore", [
      addresses.base.WETH,
    ]);
    const dOETHbVaultAdmin = await deployWithConfirmation(
      "OETHBaseVaultAdmin",
      [addresses.base.WETH]
    );

    const dwOETHb = await deployWithConfirmation("WOETHBase", [
      cOETHbProxy.address, // Base OETH token
    ]);

    const cwOETHb = await ethers.getContractAt(
      "WOETHBase",
      cwOETHbProxy.address
    );

    // ----------------
    // Governance Actions
    // ----------------
    return {
      name: "Add rate limiting to Origin Base Vault",
      actions: [
        // 1. Upgrade Vault proxy to VaultCore
        {
          contract: cOETHbVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHbVaultCore.address],
        },
        // 2. Set the VaultAdmin
        {
          contract: cOETHbVault,
          signature: "setAdminImpl(address)",
          args: [dOETHbVaultAdmin.address],
        },
        // 3. Default to a short dripper, since currently we are running zero dripper.
        {
          contract: cOETHbVault,
          signature: "setDripDuration(uint256)",
          args: [4 * 60 * 60],
        },
        // 4. Default to a 20% APR rebase rate cap
        {
          contract: cOETHbVault,
          signature: "setRebaseRateMax(uint256)",
          args: [parseUnits("20", 18)],
        },
        {
          // 5. Upgrade wOETHb proxy
          contract: cwOETHbProxy,
          signature: "upgradeTo(address)",
          args: [dwOETHb.address],
        },
        // 6. Run the second initializer
        {
          contract: cwOETHb,
          signature: "initialize2()",
          args: [],
        },
      ],
    };
  }
);

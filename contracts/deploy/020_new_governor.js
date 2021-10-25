const hre = require("hardhat");

const { log, deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "020_new_governor" },
  async ({ ethers, deployWithConfirmation }) => {
    const { guardianAddr } = await hre.getNamedAccounts();

    const cOUSDProxy = await ethers.getContract("OUSDProxy");
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cBuyback = await ethers.getContract("Buyback");

    const oldGovernor = await ethers.getContract("Governor");
    const dGovernor = await deployWithConfirmation("Governor", [
      guardianAddr,
      60,
    ]);
    log("Deployed Governor...");

    // Governance proposal
    return {
      name: "Migrate OUSD and Vault proxies to new governor",
      actions: [
        {
          // Transfer OUSDProxy governance to new governor
          contract: cOUSDProxy,
          signature: "transferGovernance(address)",
          args: [dGovernor.address],
        },
        {
          // Transfer VaultProxy governance to new governor
          contract: cVaultProxy,
          signature: "transferGovernance(address)",
          args: [dGovernor.address],
        },
        {
          contract: cBuyback,
          signature: "transferGovernance(address)",
          args: [dGovernor.address],
        },
      ],
      opts: {
        // Send the transaction from the old governor to transfer to the new
        // governor
        governorAddr: oldGovernor.address,
      },
    };
  }
);

const hre = require("hardhat");

const { log, deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "020_set_dai_default_strategy" },
  async ({ ethers, assetAddresses }) => {
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);
    const cCompoundStrategyProxy = await ethers.getContract(
      "CompoundStrategyProxy"
    );
    // Governance proposal
    return {
      name: "Set DAI default strategy to Compound",
      actions: [
        {
          // Set DAI default to Compound
          contract: cVault,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [assetAddresses.DAI, cCompoundStrategyProxy.address],
        },
      ],
    };
  }
);

const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "023_set_dai_default_strategy" },
  async ({ ethers, assetAddresses }) => {
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );
    const cVaultCore = await ethers.getContractAt(
      "VaultCore",
      cVaultProxy.address
    );
    const cCompoundStrategyProxy = await ethers.getContract(
      "CompoundStrategyProxy"
    );
    const cCompoundStrategy = await ethers.getContractAt(
      "CompoundStrategy",
      cCompoundStrategyProxy.address
    );
    // Governance proposal
    return {
      name: "Set DAI default strategy to Compound and update trustee fee",
      actions: [
        {
          contract: cCompoundStrategy,
          signature: "setPTokenAddress(address,address)",
          args: [assetAddresses.DAI, assetAddresses.cDAI],
        },
        {
          // Set DAI default to Compound
          contract: cVaultAdmin,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [assetAddresses.DAI, cCompoundStrategyProxy.address],
        },
        {
          // Set
          contract: cVaultAdmin,
          signature: "setTrusteeFeeBps(uint256)",
          args: [1000], // 1000 BPS = 10%
        },
        {
          // Allocate DAI
          contract: cVaultCore,
          signature: "allocate()",
        },
      ],
    };
  }
);

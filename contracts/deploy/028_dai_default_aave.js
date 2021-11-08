const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "028_dai_default_aave", forceDeploy: false },
  async ({ ethers, assetAddresses }) => {
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );
    const cAaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");
    const cCompoundStrategyProxy = await ethers.getContract(
      "CompoundStrategyProxy"
    );

    return {
      name: "Default DAI to AAVE Strategy",
      actions: [
        {
          // Set DAI default to AAVE
          contract: cVaultAdmin,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [assetAddresses.DAI, cAaveStrategyProxy.address],
        },
        {
          // Move 8 million DAI to AAVE
          contract: cVaultAdmin,
          signature: "reallocate(address,address,address[],uint256[])",
          args: [
            cCompoundStrategyProxy.address, // from
            cAaveStrategyProxy.address, // to
            [assetAddresses.DAI], // assets
            [ethers.utils.parseEther("8000000")], // amounts
          ],
        },
      ],
    };
  }
);

const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "124_remove_ousd_aave_strat",
    forceDeploy: false,
  },
  async () => {
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      addresses.mainnet.VaultProxy
    );

    const cAaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");
    const cMorphoGauntletPrimeUSDTProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDTStrategyProxy"
    );

    return {
      name: "Remove OUSD Aave Strategy",
      actions: [
        {
          contract: cVaultAdmin,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [addresses.mainnet.USDT, cMorphoGauntletPrimeUSDTProxy.address],
        },
        {
          contract: cVaultAdmin,
          signature: "removeStrategy(address)",
          args: [cAaveStrategyProxy.address],
        },
      ],
    };
  }
);

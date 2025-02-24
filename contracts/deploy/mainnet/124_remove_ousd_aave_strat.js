const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "124_remove_ousd_aave_strat",
    forceDeploy: false,
    reduceQueueTime: true,
    proposalId:
      "88299129181157806559379214304016095228552624275043325103321115382026366391938",
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

    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
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
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cAaveStrategyProxy.address, false],
        },
      ],
    };
  }
);

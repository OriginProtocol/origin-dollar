const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "128_remove_ousd_morpho_aave",
    forceDeploy: false,
    reduceQueueTime: true,
    proposalId:
      "47150374744617854837268881905932350474964620527004713806544167947184108941396",
  },
  async () => {
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);

    const cMorphoAaveStrategyProxy = await ethers.getContract(
      "MorphoAaveStrategyProxy"
    );
    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      cHarvesterProxy.address
    );

    return {
      name: "Remove Morpho Aave Strategy from the Vault",
      actions: [
        {
          contract: cVault,
          signature: "removeStrategy(address)",
          args: [cMorphoAaveStrategyProxy.address],
        },
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cMorphoAaveStrategyProxy.address, false],
        },
      ],
    };
  }
);

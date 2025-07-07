const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "146_morpho_governor_change",
    forceDeploy: false,
    reduceQueueTime: true,
    proposalId: "",
  },
  async () => {
    const cGauntletUSDCStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDCStrategyProxy"
    );

    const cGauntletUSDTStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDTStrategyProxy"
    );

    const cMetaMorphoStrategyProxy = await ethers.getContract(
      "MetaMorphoStrategyProxy"
    );

    return {
      name: "Transfer governorship for Morpho Strategies to the Multi-chain Guardian",
      actions: [
        {
          contract: cGauntletUSDCStrategyProxy,
          signature: "transferGovernance(address)",
          args: [addresses.multichainStrategist],
        },
        {
          contract: cGauntletUSDTStrategyProxy,
          signature: "transferGovernance(address)",
          args: [addresses.multichainStrategist],
        },
        {
          contract: cMetaMorphoStrategyProxy,
          signature: "transferGovernance(address)",
          args: [addresses.multichainStrategist],
        },
      ],
    };
  }
);

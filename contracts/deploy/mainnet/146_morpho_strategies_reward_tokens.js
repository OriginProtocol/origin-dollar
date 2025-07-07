const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "146_morpho_strategies_reward_tokens",
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

    const cGauntletUSDCStrategy = await ethers.getContractAt(
      "IStrategy",
      cGauntletUSDCStrategyProxy.address
    );

    const cGauntletUSDTStrategy = await ethers.getContractAt(
      "IStrategy",
      cGauntletUSDTStrategyProxy.address
    );

    const cMetaMorphoStrategy = await ethers.getContractAt(
      "IStrategy",
      cMetaMorphoStrategyProxy.address
    );

    return {
      name: "Re-deploy Morpho Strategies to add Morpho and Legacy Morpho as reward tokens",
      actions: [
        {
          contract: cGauntletUSDCStrategy,
          signature: "setRewardTokenAddresses(address[])",
          args: [
            [
              addresses.mainnet.MorphoToken,
              addresses.mainnet.LegacyMorphoToken,
            ],
          ],
        },
        {
          contract: cGauntletUSDTStrategy,
          signature: "setRewardTokenAddresses(address[])",
          args: [
            [
              addresses.mainnet.MorphoToken,
              addresses.mainnet.LegacyMorphoToken,
            ],
          ],
        },
        {
          contract: cMetaMorphoStrategy,
          signature: "setRewardTokenAddresses(address[])",
          args: [
            [
              addresses.mainnet.MorphoToken,
              addresses.mainnet.LegacyMorphoToken,
            ],
          ],
        },
      ],
    };
  }
);

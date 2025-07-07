const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "147_morpho_rewards_module",
    forceDeploy: false,
    reduceQueueTime: true,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    const cGauntletUSDCStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDCStrategyProxy"
    );
    const cGauntletUSDTStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDTStrategyProxy"
    );
    const cMetaMorphoStrategyProxy = await ethers.getContract(
      "MetaMorphoStrategyProxy"
    );

    await deployWithConfirmation("ClaimMorphoRewardsModule", [
      addresses.multichainStrategist,
      // Defender Relayer
      "0x4b91827516f79d6F6a1F292eD99671663b09169a",
      [
        cGauntletUSDCStrategyProxy.address,
        cGauntletUSDTStrategyProxy.address,
        cMetaMorphoStrategyProxy.address,
      ],
    ]);

    const cClaimMorphoRewardsModule = await ethers.getContract(
      "ClaimMorphoRewardsModule"
    );

    console.log(
      "ClaimMorphoRewardsModule deployed to",
      cClaimMorphoRewardsModule.address
    );

    return {
      actions: [],
    };
  }
);

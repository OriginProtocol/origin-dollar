const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "141_claimrewards_module",
    forceDeploy: false,
    reduceQueueTime: true,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    const cOUSDCurveAMOProxy = await ethers.getContract("OUSDCurveAMOProxy");
    const cOETHCurveAMOProxy = await ethers.getContract("OETHCurveAMOProxy");
    const cMorphoSteakhouseUSDCStrategyProxy = await ethers.getContract(
      "MetaMorphoStrategyProxy"
    );
    const cMorphoGauntletPrimeUSDCStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDCStrategyProxy"
    );
    const cMorphoGauntletPrimeUSDTStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDTStrategyProxy"
    );

    const cClaimStrategyRewardsSafeModule = await deployWithConfirmation(
      "ClaimStrategyRewardsSafeModule",
      [
        addresses.multichainStrategist,
        [
          cOUSDCurveAMOProxy.address,
          cOETHCurveAMOProxy.address,
          cMorphoSteakhouseUSDCStrategyProxy.address,
          cMorphoGauntletPrimeUSDCStrategyProxy.address,
          cMorphoGauntletPrimeUSDTStrategyProxy.address,
        ],
      ]
    );

    console.log(
      "ClaimStrategyRewardsSafeModule deployed to",
      cClaimStrategyRewardsSafeModule.address
    );

    return {
      actions: [],
    };
  }
);

const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "147_claim_rewards_module_upgrade",
    forceDeploy: false,
    forceSkip: false,
    reduceQueueTime: true,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    const cOUSDCurveAMOProxy = await ethers.getContract("OUSDCurveAMOProxy");
    const cOETHCurveAMOProxy = await ethers.getContract("OETHCurveAMOProxy");
    const cGauntletUSDCStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDCStrategyProxy"
    );
    const cGauntletUSDTStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDTStrategyProxy"
    );
    const cMetaMorphoStrategyProxy = await ethers.getContract(
      "MetaMorphoStrategyProxy"
    );

    await deployWithConfirmation("ClaimStrategyRewardsSafeModule", [
      addresses.multichainStrategist,
      // Defender Relayer
      "0x4b91827516f79d6F6a1F292eD99671663b09169a",
      [
        cOUSDCurveAMOProxy.address,
        cOETHCurveAMOProxy.address,
        cGauntletUSDCStrategyProxy.address,
        cGauntletUSDTStrategyProxy.address,
        cMetaMorphoStrategyProxy.address,
      ],
    ]);

    const cClaimStrategyRewardsSafeModule = await ethers.getContract(
      "ClaimStrategyRewardsSafeModule"
    );

    console.log(
      "cClaimStrategyRewardsSafeModule deployed to",
      cClaimStrategyRewardsSafeModule.address
    );

    return {
      actions: [],
    };
  }
);

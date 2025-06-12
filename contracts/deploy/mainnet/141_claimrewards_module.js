const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { isFork } = require("../../utils/hardhat-helpers");
const { impersonateAndFund } = require("../../utils/signers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "141_claimrewards_module",
    forceDeploy: false,
    reduceQueueTime: true,
    proposalId: "",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
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

    await deployWithConfirmation("ClaimStrategyRewardsSafeModule", [
      addresses.multichainStrategist,
      [
        cOUSDCurveAMOProxy.address,
        cOETHCurveAMOProxy.address,
        cMorphoSteakhouseUSDCStrategyProxy.address,
        cMorphoGauntletPrimeUSDCStrategyProxy.address,
        cMorphoGauntletPrimeUSDTStrategyProxy.address,
      ],
    ]);
    const cClaimStrategyRewardsSafeModule = await ethers.getContract(
      "ClaimStrategyRewardsSafeModule"
    );

    console.log(
      "ClaimStrategyRewardsSafeModule deployed to",
      cClaimStrategyRewardsSafeModule.address
    );

    if (isFork) {
      const safeSigner = await impersonateAndFund(
        addresses.multichainStrategist
      );

      const cSafe = await ethers.getContractAt(
        ["function enableModule(address module) external"],
        addresses.multichainStrategist
      );

      await withConfirmation(
        cSafe
          .connect(safeSigner)
          .enableModule(cClaimStrategyRewardsSafeModule.address)
      );

      console.log("Enabled module");

      await withConfirmation(
        cClaimStrategyRewardsSafeModule.connect(safeSigner).claimRewards(true)
      );

      console.log("Claimed rewards");
    }

    return {
      actions: [],
    };
  }
);

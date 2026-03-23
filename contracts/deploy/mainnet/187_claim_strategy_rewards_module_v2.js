const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { impersonateAndFund } = require("../../utils/signers");
const { isFork } = require("../../utils/hardhat-helpers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "187_claim_strategy_rewards_module_v2",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    const safeAddress = addresses.multichainStrategist;

    // Strategies whose reward tokens will be claimed and forwarded.
    const cOUSDCurveAMOProxy = await ethers.getContract("OUSDCurveAMOProxy");
    const cOETHCurveAMOProxy = await ethers.getContract("OETHCurveAMOProxy");
    const cOUSDMorphoV2StrategyProxy = await ethers.getContract(
      "OUSDMorphoV2StrategyProxy"
    );

    const strategyAddresses = [
      cOUSDCurveAMOProxy.address,
      cOETHCurveAMOProxy.address,
      cOUSDMorphoV2StrategyProxy.address,
    ];

    // Address that claimed reward tokens are forwarded to.
    // Defaults to the multichainStrategist Safe — confirm before deploying.
    const rewardsTo = addresses.mainnet.CoWHarvester;

    await deployWithConfirmation("ClaimStrategyRewardsSafeModule", [
      safeAddress, // safe
      addresses.mainnet.validatorRegistrator, // operator (Defender relayer)
      strategyAddresses,
      rewardsTo,
    ]);
    const cModule = await ethers.getContract("ClaimStrategyRewardsSafeModule");

    console.log(
      `ClaimStrategyRewardsSafeModule (for ${safeAddress}) deployed to`,
      cModule.address
    );
    console.log(`rewardsTo set to ${rewardsTo}`);

    if (isFork) {
      const safeSigner = await impersonateAndFund(safeAddress);
      const cSafe = await ethers.getContractAt(
        ["function enableModule(address module) external"],
        safeAddress
      );

      await withConfirmation(
        cSafe.connect(safeSigner).enableModule(cModule.address)
      );

      console.log("Enabled module on fork");
    }

    return {
      actions: [],
    };
  }
);

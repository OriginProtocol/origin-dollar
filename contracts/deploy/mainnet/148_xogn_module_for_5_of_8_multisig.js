const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "148_xogn_module_for_5_of_8_multisig",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    // 5 of 8 multisig
    const safeAddress = addresses.mainnet.Guardian;

    const moduleName = `CollectXOGNRewardsModule6`;
    await deployWithConfirmation(
      moduleName,
      [
        safeAddress,
        // Defender Relayer
        addresses.mainnet.validatorRegistrator,
      ],
      "CollectXOGNRewardsModule"
    );
    const cCollectXOGNRewardsModule = await ethers.getContract(moduleName);

    console.log(
      `${moduleName} (for ${safeAddress}) deployed to`,
      cCollectXOGNRewardsModule.address
    );

    return {
      actions: [],
    };
  }
);

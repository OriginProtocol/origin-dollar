const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "149_xogn_module_7",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    const safeAddress = "0xA2Cc2eAE69cBf04a3D5660bc3E689B035324Fc3F";

    const moduleName = `CollectXOGNRewardsModule7`;
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

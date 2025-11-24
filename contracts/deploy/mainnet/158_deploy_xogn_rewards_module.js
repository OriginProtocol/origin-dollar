const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "145_deploy_xogn_rewards_module",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    const safeAddresses = [
      "0x5c8228e709D7F91209DE898F6a7B8c6035A7B78f",
      "0x69497A2A170c138876F05Df01bFfDd5C4b651CF2",
      "0x684b38997afbBBC055e0BEB6d536686Ebd171bdB",
      "0xe555EFA16d38747F9e496926b576FD1ebD31DeCa",
      "0x6E75645EeDCCCAA0f472323Afce8f82B875C8CB9",
      "0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899",
    ];

    let i = 0;
    for (const safeAddress of safeAddresses) {
      i++;
      const moduleName = `CollectXOGNRewardsModule${i}`;
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
        `CollectXOGNRewardsModule${i} (for ${safeAddress}) deployed to`,
        cCollectXOGNRewardsModule.address
      );
    }

    return {
      actions: [],
    };
  }
);

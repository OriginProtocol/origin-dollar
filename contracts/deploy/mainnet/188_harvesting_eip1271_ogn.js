const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "188_harvesting_eip1271_ogn",
    forceDeploy: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    const botAddress = "0x7aD5C91914DE8D24316038567856d26BabE24C9E";

    await deployWithConfirmation(
      "harvesting_eip1271_ogn",
      [
        addresses.multichainStrategist,
        botAddress,
        addresses.composableCoW,
        addresses.GPv2VaultRelayer,
      ],
      "HarvestingEIP1271"
    );

    const cHarvestingEIP1271 = await ethers.getContract("HarvestingEIP1271");
    console.log(`HarvestingEIP1271 deployed to ${cHarvestingEIP1271.address}`);

    return {
      actions: [],
    };
  }
);

const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "183_harvesting_eip1271",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    const botAddress = "0x7aD5C91914DE8D24316038567856d26BabE24C9E";

    await deployWithConfirmation("HarvestingEIP1271", [
      addresses.multichainStrategist,
      botAddress,
      addresses.composableCoW,
      addresses.GPv2VaultRelayer,
    ]);

    const cHarvestingEIP1271 = await ethers.getContract("HarvestingEIP1271");
    console.log(`HarvestingEIP1271 deployed to ${cHarvestingEIP1271.address}`);

    return {
      actions: [],
    };
  }
);

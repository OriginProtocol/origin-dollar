const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "114_simple_harvester",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();

    // 1. Deploy contract
    const dOETHHarvesterSimple = await deployWithConfirmation(
      "OETHHarvesterSimple",
      [addresses.mainnet.Timelock, deployerAddr, deployerAddr] // Need to adjust governor, strategist and operator 
    );
    const cOETHHarvesterSimple = await ethers.getContractAt("OETHHarvesterSimple", dOETHHarvesterSimple.address);

    // Get AMO contract
    const cAMO = await ethers.getContractAt("ConvexEthMetaStrategy", addresses.mainnet.ConvexOETHAMOStrategy);

    // Governance Actions
    // ----------------
    return {
      name: "Change harvester in OETH AMO",
      actions: [
        {
          contract: cAMO,
          signature: "setHarvesterAddress(address)",
          args: [cOETHHarvesterSimple.address],
        },
      ],
    };
  }
);

const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "110_oeth_upgrade",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    // Deployer Actions
    // ----------------
    const cOETHProxy = await ethers.getContract("OETHProxy");

    // Deploy new version of OETH contract
    const dOETHImpl = await deployWithConfirmation("OETH", []);

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OETH token contract\n\
      \n\
      This upgrade enabled yield delegation controlled by xOGN governance \n\
      \n\
      ",
      actions: [
        // Upgrade the OETH token proxy contract to the new implementation
        {
          contract: cOETHProxy,
          signature: "upgradeTo(address)",
          args: [dOETHImpl.address],
        },
      ],
    };
  }
);

const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "112_upgrade_woeth",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId:
  },
  async ({ deployWithConfirmation, ethers }) => {
    const cOETHProxy = await ethers.getContract("OETHProxy");
    const cWOETHProxy = await ethers.getContract("WOETHProxy");

    const dWOETHImpl = await deployWithConfirmation("WOETH", [
      cOETHProxy.address,
    ]);

    const cWOETH = await ethers.getContractAt("WOETH", cWOETHProxy.address);

    // Governance Actions
    // ----------------
    return {
      name: `Upgrade WOETH to a new implementation.`,
      actions: [
        // 1. Upgrade WOETH
        {
          contract: cWOETHProxy,
          signature: "upgradeTo(address)",
          args: [dWOETHImpl.address],
        },
        // 2. Run the second initializer
        {
          contract: cWOETH,
          signature: "initialize2()",
          args: [],
        },
      ],
    };
  }
);

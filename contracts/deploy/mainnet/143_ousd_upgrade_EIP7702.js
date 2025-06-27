const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "143_ousd_upgrade_EIP7702",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy new OUSD implementation without storage slot checks
    const dOUSD = await deployWithConfirmation("OUSD", [], "OUSD", true);
    const cOUSDProxy = await ethers.getContract("OUSDProxy");

    // 2. Deploy new OETH implementation without storage slot checks
    const dOETH = await deployWithConfirmation("OETH", [], "OETH", true);
    const cOETHProxy = await ethers.getContract("OETHProxy");

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OUSD/OETH token contract",
      actions: [
        // 1. Upgrade the OUSD proxy to the new implementation
        {
          contract: cOUSDProxy,
          signature: "upgradeTo(address)",
          args: [dOUSD.address],
        },
        {
          contract: cOETHProxy,
          signature: "upgradeTo(address)",
          args: [dOETH.address],
        },
      ],
    };
  }
);

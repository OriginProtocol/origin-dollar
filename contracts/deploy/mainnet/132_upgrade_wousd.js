const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "132_upgrade_wousd",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId:
  },
  async ({ deployWithConfirmation, ethers }) => {
    const cOUSDProxy = await ethers.getContract("OUSDProxy");
    const cWOUSDProxy = await ethers.getContract("WrappedOUSDProxy");

    const dWOUSDImpl = await deployWithConfirmation("WrappedOusd", [
      cOUSDProxy.address,
    ]);

    const cWOUSD = await ethers.getContractAt(
      "WrappedOusd",
      cWOUSDProxy.address
    );

    // Governance Actions
    // ----------------
    return {
      name: `Upgrade WrappedOusd to a new implementation.`,
      actions: [
        // 1. Upgrade WrappedOusd
        {
          contract: cWOUSDProxy,
          signature: "upgradeTo(address)",
          args: [dWOUSDImpl.address],
        },
        // 2. Run the second initializer
        {
          contract: cWOUSD,
          signature: "initialize2()",
          args: [],
        },
      ],
    };
  }
);

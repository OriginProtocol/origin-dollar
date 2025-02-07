const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "119_multisig_as_canceller",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "68528526132026080998168122859635399048147530736160306492805070199180314362200",
  },
  async () => {
    const { timelockAddr } = await getNamedAccounts();

    const cTimelock = await ethers.getContractAt(
      "ITimelockController",
      timelockAddr
    );

    const timelockCancellerRole = await cTimelock.CANCELLER_ROLE();

    // Governance Actions
    // ----------------
    return {
      name: "Grant canceller role to 5/8 Multisig",
      actions: [
        {
          contract: cTimelock,
          signature: "grantRole(bytes32,address)",
          args: [timelockCancellerRole, addresses.mainnet.Guardian],
        },
      ],
    };
  }
);

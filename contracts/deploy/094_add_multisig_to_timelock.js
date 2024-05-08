const addresses = require("../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "094_add_multisig_to_timelock",
    forceDeploy: false,
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    reduceQueueTime: true, // just to solve the issue of later active proposals failing
    proposalId: "",
  },
  async ({ ethers }) => {
    const PROPOSER_ROLE =
      "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1"; // keccak256("PROPOSER_ROLE");
    const EXECUTOR_ROLE =
      "0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63"; // keccak256("EXECUTOR_ROLE");
    const CANCELLER_ROLE =
      "0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b62239378085726f783"; // keccak256("CANCELLER_ROLE");
    const cTimelock = await ethers.getContractAt(
      "ITimelockController",
      addresses.mainnet.Timelock
    );

    return {
      name: "Add Guardian Multisig to Timelock\n\
    \n\
    Part of the OGN/OGV merger. This proposal adds the Origin's 5 of 8 Multisig to the Timelock to provide a backup governance during the transition between governance systems during the token merger. This permission will be revoked once the merger is complete. \
    ",
      actions: [
        {
          contract: cTimelock,
          signature: "grantRole(bytes32,address)",
          args: [PROPOSER_ROLE, addresses.mainnet.Guardian],
        },
        {
          contract: cTimelock,
          signature: "grantRole(bytes32,address)",
          args: [EXECUTOR_ROLE, addresses.mainnet.Guardian],
        },
        {
          contract: cTimelock,
          signature: "grantRole(bytes32,address)",
          args: [CANCELLER_ROLE, addresses.mainnet.Guardian],
        },
      ],
    };
  }
);

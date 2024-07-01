const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "100_remove_multisig_from_timelock",
    forceDeploy: false,
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    reduceQueueTime: true, // just to solve the issue of later active proposals failing
    proposalId:
      "69085549828104010152509596999979309525574542460232172842186049358698872965097",
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
      name: "Remove Guardian Multisig from Timelock\n\
    \n\
    Part of the OGN/OGV merger. This proposal removes the Origin's 5 of 8 Multisig from the Timelock. The Multisig was previously granted the permission to help during the transition between governance systems. \
    ",
      actions: [
        {
          contract: cTimelock,
          signature: "revokeRole(bytes32,address)",
          args: [PROPOSER_ROLE, addresses.mainnet.Guardian],
        },
        {
          contract: cTimelock,
          signature: "revokeRole(bytes32,address)",
          args: [EXECUTOR_ROLE, addresses.mainnet.Guardian],
        },
        {
          contract: cTimelock,
          signature: "revokeRole(bytes32,address)",
          args: [CANCELLER_ROLE, addresses.mainnet.Guardian],
        },
      ],
    };
  }
);

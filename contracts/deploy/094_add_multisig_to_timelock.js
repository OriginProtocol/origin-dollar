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
    const TIMELOCK_ADMIN_ROLE =
      "0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5"; // keccak256("TIMELOCK_ADMIN_ROLE");
    const TIMELOCK_PROPOSER_ROLE =
      "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1"; // keccak256("TIMELOCK_PROPOSER_ROLE");
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
          args: [TIMELOCK_ADMIN_ROLE, addresses.mainnet.Guardian],
        },
        {
          contract: cTimelock,
          signature: "grantRole(bytes32,address)",
          args: [TIMELOCK_PROPOSER_ROLE, addresses.mainnet.Guardian],
        },
      ],
    };
  }
);

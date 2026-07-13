const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "194_remove_oeth_supernova_amo",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "35609681461618052145387081603214161093035331291961687423754678012941529359332",
  },
  async ({ ethers }) => {
    // Current OETH Vault contracts
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);
    const cStrategyProxy = await ethers.getContract("OETHSupernovaAMOProxy");

    // Governance Actions
    // ----------------
    return {
      name: "Remove the Supernova AMO Strategy from the OETH Vault",
      actions: [
        {
          contract: cVault,
          signature: "removeStrategy(address)",
          args: [cStrategyProxy.address],
        },
      ],
    };
  }
);

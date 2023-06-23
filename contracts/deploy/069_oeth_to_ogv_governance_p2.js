const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "069_oeth_to_ogv_governance_p2",
    forceDeploy: false
  },
  async ({
    ethers,
  }) => {
    const cOETHProxy = await ethers.getContract("OETHProxy");
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cWOETHProxy = await ethers.getContract("WOETHProxy");
    const cOETHDripperProxy = await ethers.getContract("OETHDripperProxy");
    const cConvexEthMetaStrategyProxy = await ethers.getContract("ConvexEthMetaStrategyProxy");
    const cOETHHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");
    const cOETHMorphoAaveStrategyProxy = await ethers.getContract("OETHMorphoAaveStrategyProxy");
    const cFraxETHStrategyProxy = await ethers.getContract("FraxETHStrategyProxy");

    // Governance Actions
    // ----------------
    return {
      name: "Transfer governance to OGV Governance timelock",
      actions: [
        // Claim governance by the OGV Timelock
        {
          contract: cOETHProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: cOETHVaultProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: cWOETHProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: cOETHDripperProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: cConvexEthMetaStrategyProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: cOETHHarvesterProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: cOETHMorphoAaveStrategyProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: cFraxETHStrategyProxy,
          signature: "claimGovernance()",
          args: [],
        },
      ],
    };
  }
);

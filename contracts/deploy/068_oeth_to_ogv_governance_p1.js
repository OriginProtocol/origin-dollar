const { deploymentWithProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithProposal(
  {
    deployName: "068_oeth_to_ogv_governance_p1",
    forceDeploy: false,
  },
  async ({ ethers }) => {
    const cOETHProxy = await ethers.getContract("OETHProxy");
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cWOETHProxy = await ethers.getContract("WOETHProxy");
    const cOETHDripperProxy = await ethers.getContract("OETHDripperProxy");
    const cConvexEthMetaStrategyProxy = await ethers.getContract(
      "ConvexEthMetaStrategyProxy"
    );
    const cOETHHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");
    const cOETHMorphoAaveStrategyProxy = await ethers.getContract(
      "OETHMorphoAaveStrategyProxy"
    );
    const cFraxETHStrategyProxy = await ethers.getContract(
      "FraxETHStrategyProxy"
    );

    // Governance Actions
    // ----------------
    return {
      name: "Transfer governance to OGV Governance timelock",
      actions: [
        // Transfer governance for all OETH contracts
        {
          contract: cOETHProxy,
          signature: "transferGovernance(address)",
          args: [addresses.mainnet.Timelock],
        },
        {
          contract: cOETHVaultProxy,
          signature: "transferGovernance(address)",
          args: [addresses.mainnet.Timelock],
        },
        {
          contract: cWOETHProxy,
          signature: "transferGovernance(address)",
          args: [addresses.mainnet.Timelock],
        },
        {
          contract: cOETHDripperProxy,
          signature: "transferGovernance(address)",
          args: [addresses.mainnet.Timelock],
        },
        {
          contract: cConvexEthMetaStrategyProxy,
          signature: "transferGovernance(address)",
          args: [addresses.mainnet.Timelock],
        },
        {
          contract: cOETHHarvesterProxy,
          signature: "transferGovernance(address)",
          args: [addresses.mainnet.Timelock],
        },
        {
          contract: cOETHMorphoAaveStrategyProxy,
          signature: "transferGovernance(address)",
          args: [addresses.mainnet.Timelock],
        },
        {
          contract: cFraxETHStrategyProxy,
          signature: "transferGovernance(address)",
          args: [addresses.mainnet.Timelock],
        },
      ],
    };
  }
);

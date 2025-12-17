const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "159_ousd_morpho_v2_proxy",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    await deployWithConfirmation("OUSDMorphoV2StrategyProxy");
    const cOUSDMorphoV2StrategyProxy = await ethers.getContract(
      "OUSDMorphoV2StrategyProxy"
    );

    console.log(
      `OUSDMorphoV2StrategyProxy deployed to ${cOUSDMorphoV2StrategyProxy.address}`
    );

    return {
      actions: [],
    };
  }
);

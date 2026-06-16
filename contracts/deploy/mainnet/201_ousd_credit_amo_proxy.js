const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

// Deploys the OUSD Credit Market AMO strategy proxy first, so its address is known
// before the gated Morpho V2 credit vault is configured (the credit vault must allow
// only this proxy to deposit). The implementation + registration follow in deploy 202.
module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "201_ousd_credit_amo_proxy",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    await deployWithConfirmation("OUSDCreditMarketAMOStrategyProxy");
    const cProxy = await ethers.getContract("OUSDCreditMarketAMOStrategyProxy");

    console.log(
      `OUSDCreditMarketAMOStrategyProxy deployed to ${cProxy.address}`
    );

    return {
      actions: [],
    };
  }
);

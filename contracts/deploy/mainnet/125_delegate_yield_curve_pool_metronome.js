const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "125_delegate_yield_curve_pool_metronome",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const OETH = await ethers.getContractAt(
      "OETH",
      addresses.mainnet.OETHProxy
    );
    const msETHOETHCurvePool = "0xb5b93dde9d87563184d31f3b7f85dd58404e2ee0";
    const msETHMultiSig = "0xCE3187216B39ED222319D877956aC6b2eF1961E9";

    return {
      name: "Delegate Yield from msETH/OETH Curve Pool to Treasury Boost",
      actions: [
        {
          contract: OETH,
          signature: "delegateYield(address,address)",
          args: [msETHOETHCurvePool, msETHMultiSig],
        },
      ],
    };
  }
);

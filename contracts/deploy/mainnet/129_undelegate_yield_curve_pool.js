const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "129_undelegate_yield_curve_pool",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const OUSD = await ethers.getContractAt(
      "OUSD",
      addresses.mainnet.OUSDProxy
    );

    return {
      name: "Undelegate Yield from OUSD/USDT Curve Pool",
      actions: [
        {
          contract: OUSD,
          signature: "undelegateYield(address)",
          args: [addresses.mainnet.CurveOUSDUSDTPool],
        },
      ],
    };
  }
);

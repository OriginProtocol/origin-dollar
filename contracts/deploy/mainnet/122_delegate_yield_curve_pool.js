const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "121_pool_booster_curve",
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
    const OUSDUSDTCurvePoolBooster =
      "0xF4c001dfe53C584425d7943395C7E57b10BD1DC8";
    return {
      name: "Delegate Yield from OUSD/USDT Curve Pool to PoolBooster",
      actions: [
        {
          contract: OUSD,
          signature: "delegateYield",
          args: [addresses.mainnet.CurveOUSDUSDTPool, OUSDUSDTCurvePoolBooster],
        },
      ],
    };
  }
);

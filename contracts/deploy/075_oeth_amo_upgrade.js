const addresses = require("../utils/addresses");
const { oethPoolLpPID } = require("../utils/constants");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "075_oeth_amo_upgrade",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: false,
    deployerIsProposer: true,
    proposalId:
      "52754541240413220443859027907216814653548117220338896790750636626793224597926",
  },
  async ({ ethers, deployWithConfirmation }) => {
    const cConvexEthMetaStrategyProxy = await ethers.getContract(
      "ConvexEthMetaStrategyProxy"
    );

    // Deploy and set the immutable variables
    const dConvexETHMetaStrategy = await deployWithConfirmation(
      "ConvexEthMetaStrategy",
      [
        [addresses.mainnet.CurveOETHMetaPool, addresses.mainnet.OETHVaultProxy],
        [
          addresses.mainnet.CVXBooster,
          addresses.mainnet.CVXETHRewardsPool,
          oethPoolLpPID,
          addresses.mainnet.OETHProxy,
          addresses.mainnet.WETH,
        ],
      ],
      null,
      true // force deploy as storage slots have changed
    );

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade the OETH AMO strategy with peg keeping functions.",
      actions: [
        // Upgrade the OETH AMO strategy proxy to the new strategy implementation
        {
          contract: cConvexEthMetaStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dConvexETHMetaStrategy.address],
        },
      ],
    };
  }
);

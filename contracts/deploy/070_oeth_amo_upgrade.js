const addresses = require("../utils/addresses");
const { oethPoolLpPID } = require("../utils/constants");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "070_oeth_amo_upgrade",
    forceDeploy: false,
    deployerIsProposer: true,
  },
  async ({ ethers, deployWithConfirmation }) => {
    const cConvexEthMetaStrategyProxy = await ethers.getContract(
      "ConvexEthMetaStrategyProxy"
    );

    // Deploy and set the immutable variables
    const dConvexETHMetaStrategy = await deployWithConfirmation(
      "ConvexEthMetaStrategy",
      [
        [
          addresses.mainnet.CurveOETHMetaPool,
          addresses.mainnet.OETHVaultProxy,
          addresses.mainnet.CVXBooster,
          addresses.mainnet.OETHProxy,
          addresses.mainnet.CVXETHRewardsPool,
          addresses.mainnet.CurveOETHMetaPool,
          oethPoolLpPID,
          addresses.mainnet.WETH,
        ],
      ],
      null,
      true // force deploy as storage slots have changed
    );

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade the OETH AMO strategy.\n\
      \n\
      Code PR: #",
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

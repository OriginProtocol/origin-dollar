const addresses = require("../utils/addresses");
const { metapoolLPCRVPid } = require("../utils/constants");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "075_ousd_amo_upgrade",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: true,
    // proposalId: "",
  },
  async ({ ethers, deployWithConfirmation }) => {
    const cConvexOUSDMetaStrategyProxy = await ethers.getContract(
      "ConvexOUSDMetaStrategyProxy"
    );

    // Deploy and set the immutable variables
    const dConvexOUSDMetaStrategy = await deployWithConfirmation(
      "ConvexOUSDMetaStrategy",
      [
        [addresses.mainnet.CurveOUSDMetaPool, addresses.mainnet.VaultProxy],
        [
          addresses.mainnet.CVXBooster, // cvxDepositorAddress,
          addresses.mainnet.CVXRewardsPool, // cvxRewardStakerAddress,
          metapoolLPCRVPid, // cvxDepositorPTokenId
          addresses.mainnet.OUSDProxy, // oTokenAddress (OUSD),
          addresses.mainnet.ThreePoolToken, // assetAddress (3CRV)
          0, // Curve pool index for OUSD
          1, // Curve pool index for 3CRV
        ],
        addresses.mainnet.ThreePool, // _curve3Pool
        [addresses.mainnet.DAI, addresses.mainnet.USDC, addresses.mainnet.USDT], // _curve3PoolAssets
      ],
      null,
      true // force deploy as storage slots have changed
    );

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade the OUSD AMO strategy.",
      actions: [
        // Upgrade the OUSD AMO strategy proxy to the new strategy implementation
        {
          contract: cConvexOUSDMetaStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dConvexOUSDMetaStrategy.address],
        },
      ],
    };
  }
);

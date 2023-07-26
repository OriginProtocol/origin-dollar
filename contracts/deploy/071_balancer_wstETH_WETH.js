const addresses = require("../utils/addresses");
const {
  aura_stETH_WETH_PID,
  balancer_wstETH_WETH_PID,
} = require("../utils/constants");
const balancerStrategyDeployment = require("../utils/balancerStrategyDeployment");

module.exports = balancerStrategyDeployment({
  deploymentOpts: {
    deployName: "071_balancer_wstETH_WETH",
    forceDeploy: false,
    // forceSkip: true,
    deployerIsProposer: true
  },

  proxyContractName: "OETHBalancerMetaPoolWstEthWethStrategyProxy",

  poolAddress: addresses.mainnet.wstETH_WETH_BPT,
  poolId: balancer_wstETH_WETH_PID,

  rewardStakerAddress: addresses.mainnet.CurveOUSDMetaPool,
  auraRewardPool: addresses.mainnet.auraRewardPool,
  auraDepositorPTokenId: aura_stETH_WETH_PID,

  rewardTokenAddresses: [addresses.mainnet.BAL, addresses.mainnet.AURA],
  assets: [addresses.mainnet.stETH, addresses.mainnet.WETH],
  pTokens: [addresses.mainnet.wstETH_WETH_BPT, addresses.mainnet.wstETH_WETH_BPT]
})

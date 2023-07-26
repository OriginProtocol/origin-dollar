const addresses = require("../utils/addresses");
const {
  aura_wstETH_sfrxETH_rETH_PID,
  balancer_wstETH_sfrxETH_rETH_PID,
} = require("../utils/constants");
const balancerStrategyDeployment = require("../utils/balancerStrategyDeployment");

module.exports = balancerStrategyDeployment({
  deploymentOpts: {
    deployName: "072_balancer_wstETH_sfrxETH_rETH",
    forceDeploy: false,
    forceSkip: true, // TODO: fix this
    deployerIsProposer: true
  },

  proxyContractName: "OETHBalancerMetaPoolWstEthSfrxEthREthStrategyProxy",

  poolAddress: addresses.mainnet.wstETH_rETH_sfrxETH_BPT,
  poolId: balancer_wstETH_sfrxETH_rETH_PID,

  rewardStakerAddress: addresses.mainnet.CurveOUSDMetaPool,
  auraRewardPool: addresses.mainnet.auraRewardPool,
  auraDepositorPTokenId: aura_wstETH_sfrxETH_rETH_PID,

  rewardTokenAddresses: [addresses.mainnet.BAL, addresses.mainnet.AURA],
  assets: [addresses.mainnet.wstETH_rETH_sfrxETH_BPT, addresses.mainnet.wstETH, addresses.mainnet.sfrxETH, addresses.mainnet.rETH],
  pTokens: [addresses.mainnet.wstETH_rETH_sfrxETH_BPT, addresses.mainnet.wstETH_rETH_sfrxETH_BPT, addresses.mainnet.wstETH_rETH_sfrxETH_BPT, addresses.mainnet.wstETH_rETH_sfrxETH_BPT]
})

const generalizedConvexStratDeployment = require("../utils/generalizedConvexStratDeployment");
const { tusdMetapoolLPCRVPid } = require("../utils/constants");

module.exports = generalizedConvexStratDeployment({
  deployName: "045_convex_tusd_meta_strategy",
  forceDeploy: false,
  mainTokenName: "True USD",
  mainTokenSymbol: "TUSD",
  rewardTokenNames: ["CVX", "CRV"],
  assets: ["DAI", "USDC", "USDT"],
  pTokens: ["ThreePoolToken", "ThreePoolToken", "ThreePoolToken"],
  platformAddress: ["ThreePool"],
  cvxDepositorAddress: "0xF403C135812408BFbE8713b5A23a04b3D48AAE31",
  metapoolAddress: "0xEcd5e75AFb02eFa118AF914515D6521aaBd189F1",
  metapoolLPToken: "0xEcd5e75AFb02eFa118AF914515D6521aaBd189F1",
  mainTokenAddress: "0x0000000000085d4780B73119b644AE5ecd22b376", // TrueUSD
  cvxRewardStakerAddress: "0x308b48F037AAa75406426dACFACA864ebd88eDbA",
  cvxDepositorPTokenId: tusdMetapoolLPCRVPid, // 31
  redeployVault: false,
  deployStrategyImplementation: true,
  skipMainnetDeploy: false,
});

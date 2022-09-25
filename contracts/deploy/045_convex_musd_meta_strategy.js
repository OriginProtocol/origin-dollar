const generalizedConvexStratDeployment = require("../utils/generalizedConvexStratDeployment");
const { musdMetapoolLPCRVPid } = require("../utils/constants");

module.exports = generalizedConvexStratDeployment({
  deployName: "045_convex_musd_meta_strategy",
  forceDeploy: false,
  mainTokenName: "mStable USD",
  rewardTokenNames: ["CVX", "CRV"],
  assets: ["DAI", "USDC", "USDT"],
  pTokens: ["ThreePoolToken", "ThreePoolToken", "ThreePoolToken"],
  platformAddress: ["ThreePool"],
  cvxDepositorAddress: "0xF403C135812408BFbE8713b5A23a04b3D48AAE31",
  metapoolAddress: "0x1AEf73d49Dedc4b1778d0706583995958Dc862e6",
  mainTokenAddress: "0xe2f2a5c287993345a840db3b0845fbc70f5935a5", // mStable USD
  cvxRewardStakerAddress: "0xDBFa6187C79f4fE4Cda20609E75760C5AaE88e52",
  cvxDepositorPTokenId: musdMetapoolLPCRVPid, // 14
});

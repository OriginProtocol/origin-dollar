const generalizedConvexStratDeployment = require("../utils/generalizedConvexStratDeployment");
const { convex_LUSD_3CRV_PID } = require("../utils/constants");

module.exports = generalizedConvexStratDeployment({
  deployName: "045_convex_lusd_meta_strategy",
  mainTokenName: "Liquity USD",
  mainTokenSymbol: "LUSD",
  rewardTokenNames: ["CVX", "CRV"],
  assets: ["DAI", "USDC", "USDT"],
  pTokens: ["ThreePoolToken", "ThreePoolToken", "ThreePoolToken"],
  platformAddress: ["ThreePool"],
  cvxDepositorAddress: "0xF403C135812408BFbE8713b5A23a04b3D48AAE31",
  metapoolAddress: "0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA",
  metapoolLPToken: "0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA",
  mainTokenAddress: "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0", // LUSD
  cvxRewardStakerAddress: "0x2ad92A7aE036a038ff02B96c88de868ddf3f8190",
  cvxDepositorPTokenId: convex_LUSD_3CRV_PID, // 33
  redeployVault: false,
  deployStrategyImplementation: true,
  skipMainnetDeploy: false,
  proposalId: 41, // just set to false if no proposal id yet
});

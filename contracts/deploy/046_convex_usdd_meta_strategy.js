const generalizedConvexStratDeployment = require("../utils/generalizedConvexStratDeployment");
const { usddMetapoolLPCRVPid } = require("../utils/constants");

module.exports = generalizedConvexStratDeployment({
  deployName: "046_convex_usdd_meta_strategy",
  forceDeploy: false,
  mainTokenName: "USDD",
  mainTokenSymbol: "USDD",
  rewardTokenNames: ["CVX", "CRV"],
  assets: ["DAI", "USDC", "USDT"],
  pTokens: ["ThreePoolToken", "ThreePoolToken", "ThreePoolToken"],
  platformAddress: ["ThreePool"],
  cvxDepositorAddress: "0xF403C135812408BFbE8713b5A23a04b3D48AAE31",
  metapoolAddress: "0xe6b5CC1B4b47305c58392CE3D359B10282FC36Ea",
  metapoolLPToken: "0xe6b5CC1B4b47305c58392CE3D359B10282FC36Ea",
  mainTokenAddress: "0x0c10bf8fcb7bf5412187a595ab97a3609160b5c6", // USDD
  cvxRewardStakerAddress: "0x7D475cc8A5E0416f0e63042547aDB94ca7045A5b",
  cvxDepositorPTokenId: usddMetapoolLPCRVPid, // 96
  redeployVault: false,
});

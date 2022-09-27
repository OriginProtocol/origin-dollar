const generalizedConvexStratDeployment = require("../utils/generalizedConvexStratDeployment");
const { alusdMetapoolLPCRVPid } = require("../utils/constants");

module.exports = generalizedConvexStratDeployment({
  deployName: "044_convex_alusd_meta_strategy",
  forceDeploy: true,
  mainTokenName: "Alchemix USD",
  mainTokenSymbol: "alUSD",
  rewardTokenNames: ["CVX", "CRV"],
  assets: ["DAI", "USDC", "USDT"],
  pTokens: ["ThreePoolToken", "ThreePoolToken", "ThreePoolToken"],
  platformAddress: ["ThreePool"],
  cvxDepositorAddress: "0xF403C135812408BFbE8713b5A23a04b3D48AAE31",
  metapoolAddress: "0x43b4FdFD4Ff969587185cDB6f0BD875c5Fc83f8c",
  metapoolLPToken: "0x43b4FdFD4Ff969587185cDB6f0BD875c5Fc83f8c",
  mainTokenAddress: "0xBC6DA0FE9aD5f3b0d58160288917AA56653660E9", // Alchemix USD
  cvxRewardStakerAddress: "0x02E2151D4F351881017ABdF2DD2b51150841d5B3",
  cvxDepositorPTokenId: alusdMetapoolLPCRVPid, // 36
});

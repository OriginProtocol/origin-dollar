const generalizedConvexStratDeployment = require("../utils/generalizedConvexStratDeployment");
const { busdMetapoolLPCRVPid } = require("../utils/constants");

module.exports = generalizedConvexStratDeployment({
  deployName: "047_convex_busd_meta_strategy",
  forceDeploy: true,
  mainTokenName: "Binance USD",
  mainTokenSymbol: "BUSD",
  rewardTokenNames: ["CVX", "CRV"],
  assets: ["DAI", "USDC", "USDT"],
  pTokens: ["ThreePoolToken", "ThreePoolToken", "ThreePoolToken"],
  platformAddress: ["ThreePool"],
  cvxDepositorAddress: "0xF403C135812408BFbE8713b5A23a04b3D48AAE31",
  metapoolAddress: "0x4807862AA8b2bF68830e4C8dc86D0e9A998e085a",
  metapoolLPToken: "0x4807862AA8b2bF68830e4C8dc86D0e9A998e085a",
  mainTokenAddress: "0x4fabb145d64652a948d72533023f6e7a623c7c53", // BUSD
  cvxRewardStakerAddress: "0xbD223812d360C9587921292D0644D18aDb6a2ad0",
  cvxDepositorPTokenId: busdMetapoolLPCRVPid, // 34
  redeployVault: false,
});

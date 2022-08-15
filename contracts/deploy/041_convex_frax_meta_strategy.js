const generalizedConvexStratDeployment = require("../utils/generalizedConvexStratDeployment");

module.exports = generalizedConvexStratDeployment({
  deployName: "041_convex_frax_meta_strategy",
  forceDeploy: true,
  mainTokenName: "Frax",
  rewardTokenNames: ['CVX', 'CRV'],
  assets: ['DAI', 'USDC', 'USDT'],
  pTokens: ['ThreePoolToken', 'ThreePoolToken', 'ThreePoolToken'],
  platformAddress: ['ThreePool'],
  cvxDepositorAddress: '0xF403C135812408BFbE8713b5A23a04b3D48AAE31',
  metapoolAddress: '0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B',
  fraxAddress: '0x853d955acef822db058eb8505911ed77f175b99e',
  cvxRewardStakerAddress: '0xB900EF131301B307dB5eFcbed9DBb50A3e209B2e',
  cvxDepositorPTokenId: 32
});

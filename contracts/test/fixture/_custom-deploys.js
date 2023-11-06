const addresses = require("../../utils/addresses");
const { balancer_wstETH_sfrxETH_rETH_PID } = require("../../utils/constants");
const { ethers } = hre;

const deployBalancerFrxEethRethWstEThStrategyMissConfigured = async () => {
  const { deploy } = deployments;
  const platformAddress = addresses.mainnet.wstETH_sfrxETH_rETH_BPT;
  const sTimelock = await ethers.provider.getSigner(addresses.mainnet.Timelock);

  await deploy("BalancerComposablePoolStrategy", {
    from: addresses.mainnet.Timelock,
    contract: "BalancerComposablePoolStrategy",
    args: [
      [
        addresses.mainnet.wstETH_sfrxETH_rETH_BPT,
        addresses.mainnet.OETHVaultProxy,
      ],
      [
        addresses.mainnet.rETH,
        addresses.mainnet.stETH,
        addresses.mainnet.wstETH,
        addresses.mainnet.frxETH,
        addresses.mainnet.sfrxETH,
        addresses.mainnet.balancerVault, // Address of the Balancer vault
        balancer_wstETH_sfrxETH_rETH_PID, // Pool ID of the Balancer pool
      ],
      [
        1, // ComposablePoolExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT
        2, // ComposablePoolExitKind.EXACT_BPT_IN_FOR_(ALL_)TOKENS_OUT
      ],
      addresses.mainnet.wstETH_sfrxETH_rETH_AuraRewards, // Address of the Aura rewards contract
      1, // this is configured incorrectly -> the actual BPT position is at position 0
    ],
  });

  const strategy = await ethers.getContract("BalancerComposablePoolStrategy");
  // prettier-ignore
  await strategy
    .connect(sTimelock)["initialize(address[],address[],address[])"](
      [addresses.mainnet.BAL, addresses.mainnet.AURA],
      [
        addresses.mainnet.stETH,
        addresses.mainnet.frxETH,
        addresses.mainnet.rETH,
      ],
      [platformAddress, platformAddress, platformAddress]
    );

  return strategy;
};

module.exports = {
  deployBalancerFrxEethRethWstEThStrategyMissConfigured,
};

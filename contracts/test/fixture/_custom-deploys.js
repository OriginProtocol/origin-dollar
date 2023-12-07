const addresses = require("../../utils/addresses");
const { balancer_wstETH_sfrxETH_rETH_PID } = require("../../utils/constants");
const { ethers } = hre;
const { impersonateAndFund } = require("../../utils/signers");
const log = require("../../utils/logger")("test:fixtures:custom-deploy");

const deployBalancerFrxEethRethWstEThStrategyMissConfigured = async () => {
  const { deploy } = deployments;
  const platformAddress = addresses.mainnet.wstETH_sfrxETH_rETH_BPT;
  // timelock needs some funds to be able to execute the transaction
  const sTimelock = await impersonateAndFund(addresses.mainnet.Timelock);
  log("Preparing to deploy a new BalancerComposablePoolStrategy");

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
      addresses.mainnet.wstETH_sfrxETH_rETH_AuraRewards, // Address of the Aura rewards contract
      1, // this is configured incorrectly -> the actual BPT position is at position 0
    ],
  });

  const strategy = await ethers.getContract("BalancerComposablePoolStrategy");
  log("Strategy deployed, calling initialize");
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

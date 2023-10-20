/* This file contains functions that hot deploy a contract or a set of contracts. Should/can be
 * used for fork-contract development process where the standalone (separate terminal) node
 * doesn't need to be restarted to pick up code and ABI changes.
 */
const { replaceContractAt } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { balancer_rETH_WETH_PID } = require("../../utils/constants");
const { ethers } = hre;

async function hotDeployBalancerRethWETHStrategy(balancerREthFixture) {
  const { deploy } = deployments;

  // deploy this contract that exposes internal function
  await deploy("BalancerMetaPoolTestStrategy", {
    from: addresses.mainnet.Timelock, // doesn't matter which address deploys it
    contract: "BalancerMetaPoolTestStrategy",
    args: [
      [addresses.mainnet.rETH_WETH_BPT, addresses.mainnet.OETHVaultProxy],
      [
        addresses.mainnet.rETH,
        addresses.mainnet.stETH,
        addresses.mainnet.wstETH,
        addresses.mainnet.frxETH,
        addresses.mainnet.sfrxETH,
        addresses.mainnet.balancerVault, // Address of the Balancer vault
        balancer_rETH_WETH_PID, // Pool ID of the Balancer pool
      ],
      [2, 1], //BPT_IN_FOR_EXACT_TOKENS_OUT, EXACT_BPT_IN_FOR_TOKENS_OUT
      addresses.mainnet.rETH_WETH_AuraRewards, // Address of the Aura rewards contract
    ],
  });

  const fixture = await balancerREthFixture();
  const { balancerREthStrategy, josh } = fixture;

  await replaceContractAt(
    balancerREthStrategy.address,
    await ethers.getContract("BalancerMetaPoolTestStrategy")
  );

  // add additional contract functions present in the byte code while keeping
  // the existing storage slots.
  fixture.balancerREthStrategy = await ethers.getContractAt(
    "BalancerMetaPoolTestStrategy",
    balancerREthStrategy.address
  );

  return fixture;
}

module.exports = {
  hotDeployBalancerRethWETHStrategy,
};

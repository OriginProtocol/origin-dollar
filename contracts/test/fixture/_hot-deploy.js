/* This file contains functions that hot deploy a contract or a set of contracts. Should/can be
 * used for fork-contract development process where the standalone (separate terminal) node
 * doesn't need to be restarted to pick up code and ABI changes.
 */
const { replaceContractAt } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const {
  balancer_rETH_WETH_PID,
  balancer_wstETH_sfrxETH_rETH_PID,
} = require("../../utils/constants");
const { ethers } = hre;

async function hotDeployBalancerRethWETHStrategy(balancerREthFixture) {
  /* Because of the way hardhat fixture caching works it is vital that
   * the fixtures are loaded before the hot-deployment of contracts. If the
   * contracts are hot-deployed and fixture load happens afterwards the deployed
   * contract is not visible in deployments.
   */
  const fixture = await balancerREthFixture();
  const { balancerREthStrategy } = fixture;
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
      addresses.mainnet.rETH_WETH_AuraRewards, // Address of the Aura rewards contract
    ],
  });

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

async function hotDeployBalancerFrxEethRethWstEThStrategy(
  balancerFrxETHwstETHeETHFixture
) {
  /* Because of the way hardhat fixture caching works it is vital that
   * the fixtures are loaded before the hot-deployment of contracts. If the
   * contracts are hot-deployed and fixture load happens afterwards the deployed
   * contract is not visible in deployments.
   */
  const fixture = await balancerFrxETHwstETHeETHFixture();
  const { balancerSfrxWstRETHStrategy } = fixture;
  const { deploy } = deployments;

  // deploy this contract that exposes internal function
  await deploy("BalancerComposablePoolTestStrategy", {
    from: addresses.mainnet.Timelock, // doesn't matter which address deploys it
    contract: "BalancerComposablePoolTestStrategy",
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
      0, // position of BPT token within the sfrxETH-rETH-wstETH Balancer pool
    ],
  });

  await replaceContractAt(
    balancerSfrxWstRETHStrategy.address,
    await ethers.getContract("BalancerComposablePoolTestStrategy")
  );

  // add additional contract functions present in the byte code while keeping
  // the existing storage slots.
  fixture.balancerSfrxWstRETHStrategy = await ethers.getContractAt(
    "BalancerComposablePoolTestStrategy",
    balancerSfrxWstRETHStrategy.address
  );

  return fixture;
}

async function hotDeployBalancerFrxEethRethWstEThBrokenStrategy(
  balancerFrxETHwstETHeETHFixture
) {
  /* Because of the way hardhat fixture caching works it is vital that
   * the fixtures are loaded before the hot-deployment of contracts. If the
   * contracts are hot-deployed and fixture load happens afterwards the deployed
   * contract is not visible in deployments.
   */
  const fixture = await balancerFrxETHwstETHeETHFixture();
  const { balancerSfrxWstRETHStrategy } = fixture;
  const { deploy } = deployments;

  // deploy this contract that exposes internal function
  await deploy("BalancerComposablePoolBrokenTestStrategy", {
    from: addresses.mainnet.Timelock, // doesn't matter which address deploys it
    contract: "BalancerComposablePoolBrokenTestStrategy",
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
      0, // position of BPT token within the sfrxETH-rETH-wstETH Balancer pool
    ],
  });

  await replaceContractAt(
    balancerSfrxWstRETHStrategy.address,
    await ethers.getContract("BalancerComposablePoolBrokenTestStrategy")
  );

  // add additional contract functions present in the byte code while keeping
  // the existing storage slots.
  fixture.balancerSfrxWstRETHStrategy = await ethers.getContractAt(
    "BalancerComposablePoolBrokenTestStrategy",
    balancerSfrxWstRETHStrategy.address
  );

  return fixture;
}

module.exports = {
  hotDeployBalancerRethWETHStrategy,
  hotDeployBalancerFrxEethRethWstEThStrategy,
  hotDeployBalancerFrxEethRethWstEThBrokenStrategy
};

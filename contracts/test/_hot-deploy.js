/* This file contains functions that hot deploy a contract or a set of contracts. Should/can be
 * used for fork-contract development process where the standalone (separate terminal) node
 * doesn't need to be restarted to pick up code and ABI changes.
 */
const { replaceContractAt } = require("../utils/deploy");
const addresses = require("../utils/addresses");
const {
  balancer_rETH_WETH_PID,
  balancer_wstETH_sfrxETH_rETH_PID,
} = require("../utils/constants");
const { ethers } = hre;
const log = require("../utils/logger")("test:fixtures:hot-deploy");

// based on a contract name create new implementation
async function constructNewContract(fixture, implContractName, proxyContractName) {
  const { deploy } = deployments;

  const getConstructorArguments = () => {
    if (["BalancerMetaPoolTestStrategy", "BalancerMetaPoolStrategy"].includes(implContractName)) {
      return [
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
      ];
    } else if (implContractName === "BalancerComposablePoolTestStrategy") {
      return [
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
      ];
    }
  };

  log(`Deploying new "${implContractName}" contract implementation.`)

  // deploy this contract that exposes internal function
  await deploy(implContractName, {
    from: addresses.mainnet.Timelock, // doesn't matter which address deploys it
    contract: implContractName,
    args: getConstructorArguments(),
  });

  return await ethers.getContract(implContractName);
}

/* Hot deploy a fixture if the environment vars demand so
 */
async function hotDeployOption(fixture, fixtureName) {
  const hotDeployOptions = (process.env.HOT_DEPLOY || "").split(",").map(item => item.trim());
  const isOethFixture = fixture.isOethFixture;
  const deployStrat = hotDeployOptions.includes("strategy");
  const deployVaultCore = hotDeployOptions.includes("vaultCore");
  const deployVaultAdmin = hotDeployOptions.includes("vaultAdmin");
  const deployHarvester = hotDeployOptions.includes("harvester");

  log(`Running fixture hot deployment w/ config; isOethFixture:${isOethFixture} strategy:${!!deployStrat} 
    vaultCore:${!!deployVaultCore} vaultAdmin:${!!deployVaultAdmin} harvester:${!!deployHarvester}`)

  if (deployStrat) {
    if(fixtureName === "balancerREthFixture") {
      await hotDeployFixture(
        fixture,
        "balancerREthStrategy",
        "BalancerMetaPoolStrategy",
        "OETHBalancerMetaPoolrEthStrategyProxy"
      );
    }
  }

  if (deployVaultCore) {
    // TODO: update vault core
  }
  if (deployVaultAdmin) {
    // TODO: update vault admin
  }
  if (deployHarvester) {
    // TODO: update harvester
  }
 }

/* Run the fixture and replace the main strategy contract(s) of the fixture 
 * with the freshly compiled implementation.
 */
async function hotDeployFixture(fixture, fixtureStrategyVarName, implContractName, proxyContractName) {
  /* Because of the way hardhat fixture caching works it is vital that
   * the fixtures are loaded before the hot-deployment of contracts. If the
   * contracts are hot-deployed and fixture load happens afterwards the deployed
   * contract is not visible in deployments.
   */
  const strategyProxy = fixture[fixtureStrategyVarName];

  const newlyCompiledImplContract = await constructNewContract(fixture, implContractName, proxyContractName);
  log(`New contract deployed at ${newlyCompiledImplContract.address}`);

  // fetch the contract with proxy ABI
  const proxyContract = await ethers.getContractAt(
    "InitializeGovernedUpgradeabilityProxy",
    strategyProxy.address
  );

  const liveImplContractAddress = await proxyContract.implementation();

  log(`Replacing implementation at ${liveImplContractAddress} with the fresh bytecode`);
  // replace current implementation
  await replaceContractAt(
    liveImplContractAddress,
    newlyCompiledImplContract
  );

  return fixture;
}

async function postDeploy() {

}

module.exports = {
  hotDeployOption
};
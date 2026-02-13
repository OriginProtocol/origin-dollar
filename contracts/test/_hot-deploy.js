/* This file contains functions that hot deploy a contract or a set of contracts. Should/can be
 * used for fork-contract development process where the standalone (separate terminal) node
 * doesn't need to be restarted to pick up code and ABI changes.
 */
const { ethers } = hre;

const { isFork, isCI } = require("./helpers");
const addresses = require("../utils/addresses");
const { replaceContractAt } = require("../utils/hardhat");

const log = require("../utils/logger")("test:fixtures:hot-deploy");

// based on a contract name create new implementation
async function constructNewContract(
  fixture,
  fixtureStrategyVarName,
  implContractName
) {
  const { deploy } = deployments;

  const getConstructorArguments = async () => {
    if (implContractName === "NativeStakingSSVStrategy") {
      const feeAccumulatorAddress = await fixture[
        fixtureStrategyVarName
      ].FEE_ACCUMULATOR_ADDRESS();
      return [
        [addresses.zero, addresses.mainnet.OETHVaultProxy],
        addresses.mainnet.WETH,
        addresses.mainnet.SSV,
        addresses.mainnet.SSVNetwork,
        500,
        feeAccumulatorAddress,
        addresses.mainnet.beaconChainDepositContract,
      ];
    }
  };

  log(`Deploying new "${implContractName}" contract implementation.`);

  // deploy this contract that exposes internal function
  await deploy(implContractName, {
    from: addresses.mainnet.Timelock, // doesn't matter which address deploys it
    contract: implContractName,
    args: await getConstructorArguments(),
  });

  log(`Deployed`);
  return await ethers.getContract(implContractName);
}

/* Hot deploy a fixture if the environment vars demand so
 */
async function hotDeployOption(
  fixture,
  fixtureName,
  config = { isOethFixture: false }
) {
  // Disable Hot Deploy on CI and for unit tests
  if (!isFork || isCI) return;

  const hotDeployOptions = (process.env.HOT_DEPLOY || "")
    .split(",")
    .map((item) => item.trim());

  if (!hotDeployOptions.length) return;

  const { isOethFixture } = config;
  const deployStrat = hotDeployOptions.includes("strategy");
  const deployVault = hotDeployOptions.includes("vault");
  const deployOracleRouter = hotDeployOptions.includes("oracleRouter");

  log(`Running fixture hot deployment w/ config; isOethFixture:${isOethFixture} strategy:${!!deployStrat} 
    vault:${!!deployVault}`);

  if (deployStrat) {
    if (fixtureName === "nativeStakingSSVStrategyFixture") {
      await hotDeployFixture(
        fixture, // fixture
        "nativeStakingSSVStrategy", // fixtureStrategyVarName
        "NativeStakingSSVStrategy" // implContractName
      );
    }
  }

  if (deployVault) {
    await hotDeployVault(fixture, isOethFixture);
  }
  if (deployOracleRouter) {
    await hotDeployOracleRouter(fixture, isOethFixture);
  }
}

async function hotDeployVault(fixture, isOeth) {
  const { deploy } = deployments;
  const vaultProxyName = `${isOeth ? "OETH" : ""}VaultProxy`;
  const vaultName = `${isOeth ? "OETH" : "OUSD"}Vault`;

  const cVaultProxy = await ethers.getContract(vaultProxyName);

  log(`Deploying new ${vaultName} implementation`);
  // deploy this contract that exposes internal function
  await deploy(vaultName, {
    from: addresses.mainnet.Timelock, // doesn't matter which address deploys it
    contract: vaultName,
    args: isOeth ? [fixture.weth.address] : [],
  });
  const implementation = await ethers.getContract(vaultName);

  const cVault = await ethers.getContractAt(
    "InitializeGovernedUpgradeabilityProxy",
    cVaultProxy.address
  );
  const liveImplContractAddress = await cVault.implementation();

  log(
    `Replacing implementation at ${liveImplContractAddress} with the fresh bytecode`
  );

  await replaceContractAt(liveImplContractAddress, implementation);
}

async function hotDeployOracleRouter(fixture, forOETH) {
  const { deploy } = deployments;
  const routerName = `${forOETH ? "OETH" : ""}OracleRouter`;

  const cRouter = await ethers.getContract(routerName);

  await deploy(routerName, {
    from: await fixture.strategist.getAddress(),
    args: [],
  });

  const implementation = await ethers.getContract(routerName);
  log(`Replacing implementation at ${cRouter.address} with the fresh bytecode`);
  await replaceContractAt(cRouter.address, implementation);
}

/* Run the fixture and replace the main strategy contract(s) of the fixture
 * with the freshly compiled implementation.
 */
async function hotDeployFixture(
  fixture,
  fixtureStrategyVarName,
  implContractName
) {
  /* Because of the way hardhat fixture caching works it is vital that
   * the fixtures are loaded before the hot-deployment of contracts. If the
   * contracts are hot-deployed and fixture load happens afterwards the deployed
   * contract is not visible in deployments.
   */
  const strategyProxy = fixture[fixtureStrategyVarName];

  const newlyCompiledImplContract = await constructNewContract(
    fixture,
    fixtureStrategyVarName,
    implContractName
  );
  log(`New contract deployed at ${newlyCompiledImplContract.address}`);

  // fetch the contract with proxy ABI
  const proxyContract = await ethers.getContractAt(
    "InitializeGovernedUpgradeabilityProxy",
    strategyProxy.address
  );

  const liveImplContractAddress = await proxyContract.implementation();

  log(
    `Replacing implementation at ${liveImplContractAddress} with the fresh bytecode`
  );
  // replace current implementation
  await replaceContractAt(liveImplContractAddress, newlyCompiledImplContract);

  return fixture;
}

module.exports = {
  hotDeployOption,
};

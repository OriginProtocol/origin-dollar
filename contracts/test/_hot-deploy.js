/* This file contains functions that hot deploy a contract or a set of contracts. Should/can be
 * used for fork-contract development process where the standalone (separate terminal) node
 * doesn't need to be restarted to pick up code and ABI changes.
 */
const { ethers } = hre;

const { isFork, isCI } = require("./helpers");
const addresses = require("../utils/addresses");
const { replaceContractAt } = require("../utils/hardhat");

const log = require("../utils/logger")("test:fixtures:hot-deploy");

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

  log(`Running fixture hot deployment w/ config; isOethFixture:${isOethFixture} strategy:${!!deployStrat} 
    vault:${!!deployVault}`);

  if (deployStrat) throw new Error(`No hot-deploy strategy for ${fixtureName}`);

  if (deployVault) {
    await hotDeployVault(fixture, isOethFixture);
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

module.exports = {
  hotDeployOption,
};

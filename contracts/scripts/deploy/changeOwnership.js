// Script to change ownership of contracts:
//  - OUSD proxy and Vault proxy: changes admin address
//  - Vault, Strategy, Oracles contracts: changes governor address
//
// Usage:
//  - Setup your environment
//      export BUIDLER_NETWORK=mainnet
//      export DEPLOYER_PK=<pk>
//      export PROVIDER_URL=<url>
//  - Dry-run mode:
//      node changeOwnership.js --newAddr=<addr>
//  - Run for real:
//      node changeOwnership.js --newAddr=<addr> --doIt=true

const { ethers, getNamedAccounts } = require("@nomiclabs/buidler");
const { utils } = require("ethers");

function parseArgv() {
  const args = {};
  for (const arg of process.argv) {
    const elems = arg.split("=");
    const key = elems[0];
    const val = elems.length > 1 ? elems[1] : true;
    args[key] = val;
  }
  return args;
}

async function main(config) {
  const newAddr = config.newAddr;
  if (!utils.isAddress(newAddr)) {
    throw new Error(`Invalid new address ${newAddr}`);
  }

  const {
    deployerAddr,
    proxyAdminAddr,
    governorAddr,
  } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const sProxyAdmin = await ethers.provider.getSigner(proxyAdminAddr);
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  console.log("\nAccounts:");
  console.log("===========");
  console.log(`Deployer   : ${deployerAddr}`);
  console.log(`Proxy admin: ${proxyAdminAddr}`);
  console.log(`Governor   : ${governorAddr}`);

  // Get all contracts to operate on.
  const vaultProxy = await ethers.getContract("VaultProxy");
  const ousdProxy = await ethers.getContract("OUSDProxy");
  const adminVaultProxy = await ethers.getContractAt("InitializableAdminUpgradeabilityProxy", vaultProxy.address);
  const adminOusdProxy = await ethers.getContractAt("InitializableAdminUpgradeabilityProxy", ousdProxy.address);
  const vault = await ethers.getContractAt("Vault", vaultProxy.address);
  const compoundStrategy = await ethers.getContract("CompoundStrategy");
  const mixOracle = await ethers.getContract("MixOracle");
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  const uniswapOracle = await ethers.getContract("OpenUniswapOracle");

  console.log("\nContract addresses:");
  console.log("=====================");
  console.log(`OUSD proxy:        ${ousdProxy.address}`)
  console.log(`Vault proxy:       ${vaultProxy.address}`);
  console.log(`CompoundStrategy:  ${compoundStrategy.address}`);
  console.log(`MixOracle:         ${mixOracle.address}`);
  console.log(`ChainlinkOracle:   ${chainlinkOracle.address}`);
  console.log(`OpenUniswapOracle: ${uniswapOracle.address}`);

  // Read the current admin address on the proxy contracts.
  // Note: this must be called by the admin itself.
  const vaultProxyAdminAddr = await adminVaultProxy.connect(sProxyAdmin).admin();
  const ousdProxyAdminAddr = await adminOusdProxy.connect(sProxyAdmin).admin();
  console.log("\nProxy admin addresss:");
  console.log("=======================");
  console.log(`Vault Proxy admin: ${vaultProxyAdminAddr}`);
  console.log(`OUSD Proxy admin: ${ousdProxyAdminAddr}`);

  // Read the current governor address on all the contracts.
  const vaultGovernorAddr = await vault.governor();
  const compoundStrategyGovernorAddr = await compoundStrategy.governor();
  const mixOracleGovernorAddr = await mixOracle.governor();
  const chainlinkOracleGovernoreAddr = await chainlinkOracle.governor();
  const openUniswapOracleGovernorAddr = await uniswapOracle.governor();

  console.log("\nCurrent governor addresses:");
  console.log("============================");
  console.log("Vault:             ", vaultGovernorAddr);
  console.log("CompoundStrategy:  ", compoundStrategyGovernorAddr);
  console.log("MixOracle:         ", mixOracleGovernorAddr);
  console.log("ChainlinkOracle:   ", chainlinkOracleGovernoreAddr);
  console.log("OpenUniswapOracle: ", openUniswapOracleGovernorAddr);

  // Make sure the contracts currently have the expected admin/governor.
  if (vaultProxyAdminAddr !== proxyAdminAddr) {
    throw new Error(
      `VaultProxy: Expected admin address ${vaultProxyAdminAddr} but got ${proxyAdminAddr}`
    );
  }
  if (ousdProxyAdminAddr !== proxyAdminAddr) {
    throw new Error(
      `OUSDProxy: Expected admin address ${ousdProxyAdminAddr} but got ${proxyAdminAddr}`
    );
  }
  if (vaultGovernorAddr !== governorAddr) {
    throw new Error(
      `Vault: Expected governor address ${governorAddr} but got ${vaultGovernorAddr}`
    );
  }
  if (compoundStrategyGovernorAddr !== governorAddr) {
    throw new Error(
      `CompoundStrategy: Expected governor address ${governorAddr} but got ${compoundStrategyGovernorAddr}`
    );
  }
  if (mixOracleGovernorAddr !== governorAddr) {
    throw new Error(
      `MixOracle: Expected governor address ${governorAddr} but got ${mixOracleGovernorAddr}`
    );
  }
  if (chainlinkOracleGovernoreAddr !== governorAddr) {
    throw new Error(
      `ChainlinkOracle: Expected governor address ${governorAddr} but got ${chainlinkOracleGovernoreAddr}`
    );
  }
  if (openUniswapOracleGovernorAddr !== governorAddr) {
    throw new Error(
      `OpenUniswapOracle: Expected governor address ${governorAddr} but got ${openUniswapOracleGovernorAddr}`
    );
  }

  if (args.doIt) {
    console.log(
      `Changing VaultProxy admin from ${proxyAdminAddr} to ${newAddr}`
    );
    await adminVaultProxy.connect(sProxyAdmin).changeAdmin(newAddr);
    console.log("Done");

    console.log(
      `Changing OUSDProxy admin from ${proxyAdminAddr} to ${newAddr}`
    );
    await adminOusdProxy.connect(sProxyAdmin).changeAdmin(newAddr);
    console.log("Done");

    console.log(
      `Changing governorship of contracts from ${governorAddr} to ${newAddr}`
    );

    console.log("Vault...");
    await vault.connect(sGovernor).changeGovernor(newAddr);
    console.log("Done.");

    console.log("CompoundStrategy...");
    await compoundStrategy.connect(sGovernor).changeGovernor(newAddr);
    console.log("Done.");

    console.log("MixOracle...");
    await mixOracle.connect(sGovernor).changeGovernor(newAddr);
    console.log("Done.");

    console.log("ChainlinkOracle...");
    await chainlinkOracle.connect(sGovernor).changeGovernor(newAddr);
    console.log("Done.");

    console.log("OpenUniswapOracle...");
    await uniswapOracle.connect(sGovernor).changeGovernor(newAddr);
    console.log("Done.");
  } else {
    // Dry-run mode.
    console.log(
      `Would change proxy admin from ${proxyAdminAddr} to ${newAddr}`
    );
    console.log(
      `Would change governorship of contracts from ${governorAddr} to ${newAddr}`
    );
  }
}

// Parse config.
const args = parseArgv();
const config = {
  // dry run mode vs for real.
  doIt: args["--doIt"] === "true" || false,
  newAddr: args["--newAddr"],
};
console.log("Config:");
console.log(config);

main(config)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// Script to change ownership of contracts:
//  - Proxy's admin
//  - Vault, Strategy, Oracles governor
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
  console.log("\nAccounts:");
  console.log("===========");
  console.log(`Deployer   : ${deployerAddr}`);
  console.log(`Proxy admin: ${proxyAdminAddr}`);
  console.log(`Governor   : ${governorAddr}`);

  // Get all contracts to operate on.
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vault = await ethers.getContractAt("Vault", vaultProxy.address);
  const compoundStrategy = await ethers.getContract("CompoundStrategy");
  const mixOracle = await ethers.getContract("MixOracle");
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  const uniswapOracle = await ethers.getContract("OpenUniswapOracle");

  console.log("\nContract addresses:");
  console.log("===================");
  console.log(`Vault proxy:       ${vaultProxy.address}`);
  console.log(`Vault:             ${vault.address}`);
  console.log(`CompoundStrategy:  ${compoundStrategy.address}`);
  console.log(`MixOracle:         ${mixOracle.address}`);
  console.log(`ChainlinkOracle:   ${chainlinkOracle.address}`);
  console.log(`OpenUniswapOracle: ${uniswapOracle.address}`);

  // Read the current admin address on the proxy contract.
  const vaultProxyAdminAddr = await vaultProxy.admin();
  console.log("\nProxy admin addresss:");
  console.log("=======================");
  console.log(`Admin: ${vaultProxyAdminAddr}`);

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
      `VaultProxy: Expected admin address ${proxyAdminAddr} but got ${proxyAdminAddr}`
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
    await vaultProxy.connect(sDeployer).changeAdmin(newAddr);
    console.log("Done");

    console.log(
      `Changing governorship of contracts from ${governorAddr} to ${newAddr}`
    );

    console.log("Vault...");
    await vault.connect(sDeployer).changeGovernor(newAddr);
    console.log("Done.");

    console.log("CompoundStrategy...");
    await compoundStrategy.connect(sDeployer).changeGovernor(newAddr);
    console.log("Done.");

    console.log("MixOracle...");
    await mixOracle.connect(sDeployer).changeGovernor(newAddr);
    console.log("Done.");

    console.log("ChainlinkOracle...");
    await chainlinkOracle.connect(sDeployer).changeGovernor(newAddr);
    console.log("Done.");

    console.log("OpenUniswapOracle...");
    await uniswapOracle.connect(sDeployer).changeGovernor(newAddr);
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

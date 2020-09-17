// Script to check contracts have been properly deployed and configured.
//
// Usage:
//  - Setup your environment
//      export BUIDLER_NETWORK=mainnet
//      export PROVIDER_URL=<url>
//      node checkDeploy.js

const { ethers, getNamedAccounts } = require("@nomiclabs/buidler");
const { utils } = require("ethers");

async function main() {
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
  const vault = await ethers.getContractAt("Vault", vaultProxy.address);
  const compoundStrategy = await ethers.getContract("CompoundStrategy");
  const mixOracle = await ethers.getContract("MixOracle");
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  const uniswapOracle = await ethers.getContract("OpenUniswapOracle");

  console.log("\nContract addresses:");
  console.log("=====================");
  console.log(`OUSD proxy:        ${ousdProxy.address}`);
  console.log(`Vault proxy:       ${vaultProxy.address}`);
  console.log(`CompoundStrategy:  ${compoundStrategy.address}`);
  console.log(`MixOracle:         ${mixOracle.address}`);
  console.log(`ChainlinkOracle:   ${chainlinkOracle.address}`);
  console.log(`OpenUniswapOracle: ${uniswapOracle.address}`);

  //
  // Check Governors
  //

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

  //
  // Check OUSD
  //

  //
  // Check Vault settings
  //

  // TODO

  //
  // Check Compound strategy
  //

  // TODO

  //
  // Check MixOracle settings
  //

  // TODO

  //
  // Check ChainlinkOracle settings
  //

  //
  // Check OpenUniswapOracle settings
}

main(config)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

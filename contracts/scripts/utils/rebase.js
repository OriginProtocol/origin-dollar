// Script for calling rebase on the vault.
//
// Usage:
//  - Setup your environment
//      export HARDHAT_NETWORK=mainnet
//      export DEPLOYER_PK=<pk>
//      export GAS_MULTIPLIER=<multiplier> e.g. 1.1
//      export PROVIDER_URL=<url>
//  - Run:
//      node rebase.js --doIt=true
//

const { ethers, getNamedAccounts } = require("hardhat");

const { isMainnet, isRinkeby } = require("../../test/helpers.js");

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

async function main(config) {
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = ethers.provider.getSigner(deployerAddr);

  const vaultProxy = await ethers.getContract("VaultProxy");
  const vault = await ethers.getContractAt("IVault", vaultProxy.address);

  if (config.doIt) {
    console.log("Sending a tx to call rebase() on", vaultProxy.address);
    let transaction;
    transaction = await vault.connect(sDeployer).rebase();
    console.log("Sent. tx hash:", transaction.hash);
    console.log("Waiting for confirmation...");
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    console.log("Rebase tx confirmed");
  } else {
    console.log(
      `Would send a tx to call rebase() on Vault at ${vault.address}`
    );
  }

  console.log("Done");
}

// Util to parse command line args.
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

// Parse config.
const args = parseArgv();
const config = {
  // dry run mode vs for real.
  doIt: args["--doIt"] === "true" || false,
};
console.log("Config:");
console.log(config);

// Run the job.
main(config)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

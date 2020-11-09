// Script for calling harvest on the vault.
//
// Usage:
//  - Setup your environment
//      export BUIDLER_NETWORK=mainnet
//      export DEPLOYER_PK=<pk>
//      export GAS_MULTIPLIER=<multiplier> e.g. 1.1
//      export PROVIDER_URL=<url>
//  - Run:
//      node harvest.js --doIt=true
//

const { ethers, getNamedAccounts } = require("@nomiclabs/buidler");

const { isMainnet, isRinkeby } = require("../../test/helpers.js");

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

async function main(config) {
  const { governorAddr } = await getNamedAccounts();
  const sGovernor = ethers.provider.getSigner(governorAddr);

  const vaultProxy = await ethers.getContract("VaultProxy");
  const vault = await ethers.getContractAt("IVault", vaultProxy.address);

  if (config.doIt) {
    console.log("Sending a tx to call harvest() on", vaultProxy.address);
    let transaction;
    transaction = await vault
      .connect(sGovernor)
      ["harvest()"]({ gasLimit: 4000000 });
    console.log("Sent. tx hash:", transaction.hash);
    console.log("Waiting for confirmation...");
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    console.log("Harvest tx confirmed");
  } else {
    console.log(
      `Would send a tx to call harvest() on Vault at ${vault.address}`
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
  gasLimit: args["--gasLimit"],
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

// Script to update settings on the Vault.
//
// Usage:
//  - Setup your environment
//      export BUIDLER_NETWORK=mainnet
//      export GOVERNOR_PK=<pk>
//      export PROVIDER_URL=<url>
//  - Dry-run mode:
//      node updateVaultSettings.js
//  - Run for real:
//      node updateVaultSettings.js --doIt=true

const { ethers, getNamedAccounts } = require("@nomiclabs/buidler");
const { utils } = require("ethers");

const { isMainnet, isRinkeby } = require("../test/helpers.js");
const { getTxOpts } = require("../utils/tx");

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

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
  const newGovernorAddr = config.newGovernorAddr;
  if (!utils.isAddress(newGovernorAddr)) {
    throw new Error(`Invalid new governor address ${newGovernorAddr}`);
  }

  const { governorAddr } = await getNamedAccounts();
  const sGovernor = await ethers.provider.getSigner(governorAddr);
  console.log(`Governor: ${governorAddr}`);

  const vaultProxy = await ethers.getContract("VaultProxy");
  const vault = await ethers.getContractAt("Vault", vaultProxy.address);

  let tx;

  tx = await vault
    .connect(sGovernor)
    .setRebaseThreshold(utils.parseUnits("1000", 18), await getTxOpts());
  console.log("setRebaseThreshold tx sent.");
  await ethers.provider.waitForTransaction(tx.hash, NUM_CONFIRMATIONS);
  console.log("setRebaseThreshold tx confirmed.");
  console.log("Rebase threshold set to 1,000 USD");

  tx = await vault
    .connect(sGovernor)
    .setAutoAllocateThreshold(utils.parseUnits("25000", 18), await getTxOpts());
  console.log("setAutoAllocateThreshold tx sent.");
  await ethers.provider.waitForTransaction(tx.hash, NUM_CONFIRMATIONS);
  console.log("setAutoAllocateThreshold tx confirmed.");
  console.log("Auto-allocated threshold set to 25,000 USD");

  console.log("Done");
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

// Script for sending a governance proposal.
// This can be sent by any account, but the script uses the deployer account
// for simplicity since it is already configured in buidler.
//
// Usage:
//  - Setup your environment
//      export BUIDLER_NETWORK=mainnet
//      export DEPLOYER_PK=<pk>
//      export PREMIUM_GAS=<percentage extra>
//      export PROVIDER_URL=<url>
//  - Run:
//      node propose.js --<action>
//

const { ethers, getNamedAccounts } = require("@nomiclabs/buidler");
const { utils } = require("ethers");

const { isMainnet, isRinkeby } = require("../../test/helpers.js");
const { proposeArgs } = require("../../utils/governor");
const { getTxOpts } = require("../../utils/tx");

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

// Returns the arguments to use for sending a proposal to call harvest() on the vault.
async function proposeHarvestArgs() {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );

  const args = await proposeArgs([
    {
      contract: vaultAdmin,
      signature: "harvest()",
    },
  ]);
  const description = "Call harvest";
  return { args, description };
}

// Returns the arguments to use for sending a proposal to call setUniswapAddr(address) on the vault.
async function proposeSetUniswapAddrArgs(config) {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );

  const args = await proposeArgs([
    {
      contract: vaultAdmin,
      signature: "setUniswapAddr(address)",
      args: [config.address],
    },
  ]);
  const description = "Call setUniswapAddr";
  return { args, description };
}

// Returns the argument to use for sending a proposal to upgrade VaultCore.
async function proposeUpgradeVaultCoreArgs(config) {
  const vaultProxy = await ethers.getContract("VaultProxy");

  const args = await proposeArgs([
    {
      contract: vaultProxy,
      signature: "upgradeTo(address)",
      args: [config.address],
    },
  ]);
  const description = "Upgrade VaultCore";
  return { args, description };
}

async function main(config) {
  const governor = await ethers.getContract("Governor");
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = ethers.provider.getSigner(deployerAddr);

  let proposalCount = await governor.proposalCount();
  console.log("Current proposal count=", proposalCount.toString());

  let argsMethod;
  if (config.harvest) {
    console.log("Harvest proposal");
    argsMethod = proposeHarvestArgs;
  } else if (config.setUniswapAddr) {
    console.log("setUniswapAddr proposal");
    argsMethod = proposeSetUniswapAddrArgs;
  } else if (config.upgradeVaultCore) {
    console.log("upgradeVaultCore proposal");
    argsMethod = proposeUpgradeVaultCoreArgs;
  } else {
    console.error("An action must be specified on the command line.");
    return;
  }
  const { args, description } = await argsMethod(config);

  if (config.doIt) {
    console.log("Sending a tx calling propose() on", governor.address);
    let transaction;
    transaction = await governor
      .connect(sDeployer)
      .propose(...args, description, await getTxOpts());
    console.log("Sent. tx hash:", transaction.hash);
    console.log("Waiting for confirmation...");
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    console.log("Propose tx confirmed");
  } else {
    console.log("Would send a tx to call propose() on", governor.address);
    console.log("args:", args);
  }

  const newProposalId = await governor.proposalCount();
  console.log("New proposal count=", newProposalId.toString());
  console.log(
    `Next step: call the following method on the governor at ${governor.address} via multi-sig`
  );
  console.log(`   queue(${newProposalId.toString()})`);
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
  address: args["--address"],
  harvest: args["--harvest"],
  setUniswapAddr: args["--setUniswapAddr"],
  upgradeVaultCore: args["--upgradeVaultCore"],
};
console.log("Config:");
console.log(config);

// Validate arguments.
if (config.address) {
  if (!utils.isAddress(config.address)) {
    throw new Error(`Invalid Ethereum address ${config.address}`);
  }
}

// Run the job.
main(config)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

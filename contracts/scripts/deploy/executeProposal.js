// Script to send a tx to the governor to execute a proposal.
// This can be sent by any account, but the script uses the deployer account
// for simplicity since it is already configured in buidler.
//
// Note: execute can only be called once the TimeLock is expired.
//
// Usage:
//  - Setup your environment
//      export BUIDLER_NETWORK=mainnet
//      export PROVIDER_URL=<url>
//  - Run in dry-mode:
//      node executeProposal.js --proposalId=<id>
//  - Run for real:
//      node executeProposal.js --proposalId=<id> --doIt=true

const { ethers, getNamedAccounts } = require("@nomiclabs/buidler");

const { isMainnet, isRinkeby } = require("../../test/helpers.js");

const { getTxOpts } = require("../../utils/tx");

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

async function main(config) {
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = ethers.provider.getSigner(deployerAddr);

  const governor = await ethers.getContractAt("Governor", config.govAddr);
  console.log(`Governor Contract: ${governor.address}`);

  const numProposals = await governor.proposalCount();
  console.log("Total number of proposals:", numProposals.toString());

  const proposalId = Number(config.propId);

  // Check the state of the proposal.
  let proposalState = await governor.state(proposalId);
  console.log("Current proposal state:", proposalState);

  // Fetch the proposal.
  const response = await governor.getActions(proposalId);
  console.log(`getActions(${proposalId})`, response);

  if (config.doIt) {
    console.log(`Sending tx to execute proposal ${proposalId}...`);
    const transaction = await governor
      .connect(sDeployer)
      .execute(proposalId, await getTxOpts());
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    console.log("Confirmed proposal execution");

    // The state of the proposal should have changed.
    proposalState = await governor.getState(proposalId);
    console.log("New proposal state:", proposalState);
  } else {
    console.log(`Would approve proposal ${proposalId}`);
  }
}

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
  verbose: args["--doIt"] === "true" || false,
  govAddr: args["--govAddr"],
  propId: args["--propId"],
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

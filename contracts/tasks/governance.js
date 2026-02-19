const { sleep } = require("../utils/time.js");

async function execute(taskArguments, hre) {
  const { isMainnet, isFork } = require("../test/helpers");
  const { withConfirmation, impersonateGuardian } = require("../utils/deploy");

  if (isMainnet) {
    throw new Error("The execute task can not be used on mainnet");
  }

  const propId = taskArguments.id;
  const { governorAddr, guardianAddr } = await getNamedAccounts();
  const sGovernor = hre.ethers.provider.getSigner(governorAddr);
  const sGuardian = hre.ethers.provider.getSigner(guardianAddr);

  if (isFork) {
    await impersonateGuardian();
  }

  let governor;
  if (taskArguments.governor) {
    governor = await hre.ethers.getContractAt(
      "Governor",
      taskArguments.governor
    );
  } else {
    governor = await hre.ethers.getContract("Governor");
  }
  console.log(`Governor Contract: ${governor.address}`);

  // Check the state of the proposal.
  let proposalState = await governor.state(propId);
  console.log("Current proposal state:", proposalState);

  // Add the proposal to the queue if it's not in there yet.
  if (proposalState !== 1) {
    if (isFork) {
      console.log("Queuing proposal");
      await withConfirmation(governor.connect(sGuardian).queue(propId));
      console.log("Waiting for TimeLock. Sleeping for 61 seconds...");
      await sleep(61000);
    } else {
      throw new Error(
        "Error: Only proposal with state 1 (Queued) can be executed!"
      );
    }
  }

  // Display the proposal.
  const response = await governor.getActions(propId);
  console.log(`getActions(${taskArguments.id})`, response);

  // Execute the proposal.
  if (isFork) {
    // On the fork, impersonate the guardian and execute the proposal.
    await impersonateGuardian();
    await withConfirmation(governor.connect(sGuardian).execute(propId));
  } else {
    // Localhost network. Execute as the governor account.
    await governor.connect(sGovernor).execute(propId);
  }
  console.log("Confirmed proposal execution");

  // The state of the proposal should have changed.
  proposalState = await governor.state(propId);
  console.log("New proposal state:", proposalState);
}

async function executeOnFork(taskArguments) {
  const { executeProposalOnFork } = require("../utils/deploy");

  const proposalId = Number(taskArguments.id);
  const gasLimit = taskArguments.gaslimit
    ? Number(taskArguments.gaslimit)
    : null;
  console.log("Enqueueing and executing proposal", proposalId);
  await executeProposalOnFork({ proposalId, executeGasLimit: gasLimit });
}

async function proposal(taskArguments, hre) {
  const proposalId = Number(taskArguments.id);
  const governor = await hre.ethers.getContract("Governor");
  const proposal = await governor["proposals(uint256)"](proposalId);
  const actions = await governor.getActions(proposalId);

  console.log(`Governor at ${governor.address}`);
  console.log(`Proposal ${proposal.id}`);
  console.log("===========");
  console.log(`  executed: ${proposal.executed}`);
  console.log(`  eta:      ${proposal.eta}`);
  console.log(`  proposer: ${proposal.proposer}`);
  console.log("  actions:  ", JSON.stringify(actions, null, 2));
}

// Dumps the governor address for all the known contracts in the system.
async function governors() {
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cVaultProxy = await ethers.getContract("VaultProxy");

  console.log("Governor addresses:");
  console.log("===================");
  console.log("OUSDProxy:              ", await cOUSDProxy.governor());
  console.log("VaultProxy:             ", await cVaultProxy.governor());
}

module.exports = {
  execute,
  executeOnFork,
  proposal,
  governors,
};

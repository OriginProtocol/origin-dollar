const { isMainnet, isRinkeby, isGanacheFork } = require("../test/helpers.js");
const { getTxOpts } = require("../utils/tx");
const { proposeArgs } = require("../utils/governor");

let totalDeployGasUsed = 0;

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

function log(msg, deployResult = null) {
  if (isMainnet || isRinkeby || process.env.VERBOSE) {
    if (deployResult) {
      const gasUsed = Number(deployResult.receipt.gasUsed.toString());
      totalDeployGasUsed += gasUsed;
      msg += ` Address: ${deployResult.address} Gas Used: ${gasUsed}`;
    }
    console.log("INFO:", msg);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const upgradeOusd = async ({ getNamedAccounts, deployments }) => {
  let transaction;

  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();

  console.log("Running 018_ousd_upgrade deployment...");

  const sDeployer = ethers.provider.getSigner(deployerAddr);
  const sGovernor = ethers.provider.getSigner(governorAddr);

  // Deploy a new vault.
  const dOusd = await deploy("OUSD", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dOusd.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed OUSD", dOusd);

  if (isMainnet) {
    // The upgrade on Mainnet has to be handled manually since it involves a multi-sig tx.
    console.log(
      "Next step: submit a governance proposal on Mainnet to perform the upgrade."
    );
  } else {
    // Upgrade  by issuing and executing a governance proposal.
    const governorContract = await ethers.getContract("Governor");
    const sGuardian = sGovernor;

    console.log("Submitting proposal for OUSD upgrade...");

    const cOUSDProxy = await ethers.getContract("OUSDProxy");

    const upgradeArgs = await proposeArgs([
      {
        contract: cOUSDProxy,
        signature: "upgradeTo(address)",
        args: [dOusd.address],
      },
    ]);
    const description = "OUSD upgrade";

    transaction = await governorContract
      .connect(sDeployer)
      .propose(...upgradeArgs, description, await getTxOpts());
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    const proposalId = await governorContract.proposalCount();
    console.log(`Submitted proposal ${proposalId}`);

    console.log("Queueing proposal...");
    await governorContract
      .connect(sGuardian)
      .queue(proposalId, await getTxOpts());
    console.log("Waiting for TimeLock. Sleeping for 61 seconds...");
    await sleep(61000);

    transaction = await governorContract
      .connect(sDeployer)
      .execute(proposalId, await getTxOpts());
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    console.log("Proposal executed");
    console.log("Proposal executed. OUSD Proxy now points to", dOusd.address);
  }

  console.log(
    "018_ousd_upgrade deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

upgradeOusd.dependencies = ["core"];
upgradeOusd.skip = () => !(isMainnet || isRinkeby || isGanacheFork);

module.exports = upgradeOusd;

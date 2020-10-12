const { isMainnet, isRinkeby } = require("../test/helpers.js");
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

const upgradeVaultCore = async ({ getNamedAccounts, deployments }) => {
  console.log("Running 012_vault_core_upgrade deployment...");

  let transaction;
  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();
  const sDeployer = ethers.provider.getSigner(deployerAddr);
  const sGovernor = ethers.provider.getSigner(governorAddr);

  // Deploy a new vault core.
  const dVaultCore = await deploy("VaultCore", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dVaultCore.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed VaultCore", dVaultCore);

  if (isMainnet) {
    // The upgrade on Mainnet has to be handled manually since it involves the multi-sig.
    console.log(
      "Next step: submit a governance proposal on Mainnet to upgrade VaultCore."
    );
    console.log(
      "Refer to src/contracts/script/governor/README.md for instructions."
    );
  } else {
    // Upgrade VaultCore by issuing and executing a governance proposal.
    const governorContract = await ethers.getContract("Governor");
    const vaultProxy = await ethers.getContract("VaultProxy");
    const sGuardian = sGovernor;

    console.log("Submitting proposal for VaultCore upgrade...");
    const upgradeArgs = await proposeArgs([
      {
        contract: vaultProxy,
        signature: "upgradeTo(address)",
        args: [dVaultCore.address],
      },
    ]);
    const description = "VaultCore upgrade";
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
    console.log(
      "Proposal executed. VaultCore now points to",
      dVaultCore.address
    );
    console.log("Done");
  }

  console.log(
    "012_vault_core_upgrade deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

upgradeVaultCore.dependencies = ["core"];
upgradeVaultCore.skip = () => !(isMainnet || isRinkeby);

module.exports = upgradeVaultCore;

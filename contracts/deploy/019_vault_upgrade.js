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

const upgradeVaultCoreAndAdmin = async ({ getNamedAccounts, deployments }) => {
  console.log("Running 019_vault_upgrade deployment...");

  let transaction;
  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();
  const sDeployer = ethers.provider.getSigner(deployerAddr);
  const sGovernor = ethers.provider.getSigner(governorAddr);

  // Deploy a new vault core contract.
  const dVaultCore = await deploy("VaultCore", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dVaultCore.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed VaultCore", dVaultCore);

  // Deploy a new vault admin contract.
  const dVaultAdmin = await deploy("VaultAdmin", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dVaultAdmin.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed VaultAdmin", dVaultAdmin);

  if (isMainnet) {
    // The upgrade on Mainnet has to be handled manually since it involves a multi-sig tx.
    console.log(
      "Next step: submit a governance proposal on Mainnet to perform the upgrade."
    );
  } else if (isGanacheFork) {
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultCoreProxy = await ethers.getContractAt(
      "VaultCore",
      cVaultProxy.address
    );
    const cVaultCore = await ethers.getContract("VaultCore");
    const cVaultAdmin = await ethers.getContract("VaultAdmin");
    await cVaultProxy.connect(sGovernor).upgradeTo(cVaultCore.address);
    await cVaultCoreProxy.connect(sGovernor).setAdminImpl(cVaultAdmin.address);
  } else {
    // Upgrade the Vault by issuing and executing a governance proposal.
    const governorContract = await ethers.getContract("Governor");
    const sGuardian = sGovernor;

    console.log("Submitting proposal for Vault Core and Admin upgrade...");

    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultCoreProxy = await ethers.getContractAt(
      "VaultCore",
      cVaultProxy.address
    );
    const cVaultCore = await ethers.getContract("VaultCore");
    const cVaultAdmin = await ethers.getContract("VaultAdmin");

    const upgradeArgs = await proposeArgs([
      {
        contract: cVaultProxy,
        signature: "upgradeTo(address)",
        args: [cVaultCore.address],
      },
      {
        contract: cVaultCoreProxy,
        signature: "setAdminImpl(address)",
        args: [cVaultAdmin.address],
      },
    ]);
    const description = "Vault Core and Admin upgrade";

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
    console.log(
      "Proposal executed. VaultCore now points to",
      dVaultCore.address
    );
    console.log("Done");
  }

  console.log(
    "019_vault_upgrade deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

upgradeVaultCoreAndAdmin.dependencies = ["core"];
upgradeVaultCoreAndAdmin.skip = () =>
  !(isMainnet || isRinkeby || isGanacheFork);

module.exports = upgradeVaultCoreAndAdmin;

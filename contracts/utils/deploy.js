//
// Deployment utilities
//

const hre = require("hardhat");
const { utils } = require("ethers");

const {
  advanceTime,
  isMainnet,
  isFork,
  isMainnetOrFork,
  getOracleAddresses,
  getAssetAddresses,
  isSmokeTest,
  isForkTest,
} = require("../test/helpers.js");

const {
  assertUpgradeIsSafe,
  storeStorageLayoutForContract,
} = require("../tasks/storageSlots");

const addresses = require("../utils/addresses.js");
const { getTxOpts } = require("../utils/tx");
const { proposeArgs } = require("../utils/governor");

// Wait for 3 blocks confirmation on Mainnet.
const NUM_CONFIRMATIONS = isMainnet ? 3 : 0;

function log(msg, deployResult = null) {
  if (isMainnetOrFork || process.env.VERBOSE) {
    if (deployResult && deployResult.receipt) {
      const gasUsed = Number(deployResult.receipt.gasUsed.toString());
      msg += ` Address: ${deployResult.address} Gas Used: ${gasUsed}`;
    }
    console.log("INFO:", msg);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const deployWithConfirmation = async (
  contractName,
  args,
  contract,
  skipUpgradeSafety = false
) => {
  // check that upgrade doesn't corrupt the storage slots
  if (!skipUpgradeSafety) {
    await assertUpgradeIsSafe(hre, contractName);
  }

  const { deploy } = deployments;
  const { deployerAddr } = await getNamedAccounts();
  if (!args) args = null;
  if (!contract) contract = contractName;
  const result = await withConfirmation(
    deploy(contractName, {
      from: deployerAddr,
      args,
      contract,
      fieldsToCompare: null,
      ...(await getTxOpts()),
    })
  );

  // if upgrade happened on the mainnet save the new storage slot layout to the repo
  if (isMainnet) {
    await storeStorageLayoutForContract(hre, contractName);
  }

  log(`Deployed ${contractName}`, result);
  return result;
};

const withConfirmation = async (deployOrTransactionPromise) => {
  const result = await deployOrTransactionPromise;
  await hre.ethers.provider.waitForTransaction(
    result.receipt ? result.receipt.transactionHash : result.hash,
    NUM_CONFIRMATIONS
  );
  return result;
};

/**
 * Impersonate the guardian. Only applicable on Fork.
 */
const impersonateGuardian = async (optGuardianAddr = null) => {
  if (!isFork) {
    throw new Error("impersonateGuardian only works on Fork");
  }
  const { findBestMainnetTokenHolder } = require("../utils/funding");

  // If an address is passed, use that otherwise default to
  // the guardian address from the default hardhat accounts.
  const guardianAddr =
    optGuardianAddr || (await hre.getNamedAccounts()).guardianAddr;

  const bestSigner = await findBestMainnetTokenHolder(null, hre);
  await bestSigner.sendTransaction({
    to: guardianAddr,
    value: utils.parseEther("100"),
  });

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [guardianAddr],
  });
  log(`Impersonated Guardian at ${guardianAddr}`);
};

/**
 * Execute a proposal on local test network (including on Fork).
 *
 * @param {Array<Object>} proposalArgs
 * @param {string} description
 * @param {opts} Options
 *   governorAddr: address of the governor contract to send the proposal to
 *   guardianAddr: address of the guardian (aka the governor's admin) to use for sending the queue and execute tx
 * @returns {Promise<void>}
 */
const executeProposal = async (proposalArgs, description, opts = {}) => {
  if (isMainnet) {
    throw new Error("executeProposal only works on local test network");
  }

  const namedAccounts = await hre.getNamedAccounts();
  const deployerAddr = namedAccounts.deployerAddr;
  const guardianAddr = opts.guardianAddr || namedAccounts.guardianAddr;

  const sGuardian = hre.ethers.provider.getSigner(guardianAddr);
  const sDeployer = hre.ethers.provider.getSigner(deployerAddr);

  if (isFork) {
    await impersonateGuardian(opts.guardianAddr);
  }

  let governorContract;
  if (opts.governorAddr) {
    governorContract = await ethers.getContractAt(
      "Governor",
      opts.governorAddr
    );
  } else {
    governorContract = await ethers.getContract("Governor");
  }
  const admin = await governorContract.admin();
  log(
    `Using governor contract at ${governorContract.address} with admin ${admin}`
  );

  const txOpts = await getTxOpts();

  log(`Submitting proposal for ${description}`);
  await withConfirmation(
    governorContract
      .connect(sDeployer)
      .propose(...proposalArgs, description, txOpts)
  );
  const proposalId = await governorContract.proposalCount();
  log(`Submitted proposal ${proposalId}`);

  await withConfirmation(
    governorContract.connect(sGuardian).queue(proposalId, txOpts)
  );
  log(`Proposal ${proposalId} queued`);

  log("Advancing time by 48 hours + 1 second for TimeLock delay.");
  await advanceTime(172801);

  await withConfirmation(
    governorContract.connect(sGuardian).execute(proposalId, txOpts)
  );
  log("Proposal executed");
};

/**
 * Given a proposal Id, enqueues and executes it. Only for usage on Fork.
 * @param {Number} proposalId
 * @returns {Promise<void>}
 */
const executeProposalOnFork = async ({
  proposalId,
  executeGasLimit = null,
  skipQueue = false,
}) => {
  if (!isFork) throw new Error("Can only be used on Fork");

  // Get the guardian of the governor and impersonate it.
  const { guardianAddr } = await hre.getNamedAccounts();
  const sGuardian = hre.ethers.provider.getSigner(guardianAddr);
  await impersonateGuardian();

  const governor = await ethers.getContract("Governor");

  if (!skipQueue) {
    //First enqueue the proposal, then execute it.
    await withConfirmation(
      governor.connect(sGuardian).queue(proposalId, await getTxOpts())
    );

    log(`Proposal ${proposalId} queued`);
  }

  log("Advancing time by 48 hours + 1 second for TimeLock delay.");
  await advanceTime(172801);

  await withConfirmation(
    governor
      .connect(sGuardian)
      .execute(proposalId, await getTxOpts(executeGasLimit))
  );
  log(`Proposal ${proposalId} executed`);
};

/**
 * Sends a proposal to the governor contract.
 * @param {Array<Object>} proposalArgs
 * @param {string} description
 * @returns {Promise<void>}
 */
const sendProposal = async (proposalArgs, description, opts = {}) => {
  if (!isMainnet && !isFork) {
    throw new Error("sendProposal only works on Mainnet and Fork networks");
  }

  const { deployerAddr } = await hre.getNamedAccounts();
  const sDeployer = hre.ethers.provider.getSigner(deployerAddr);

  let governor;
  if (opts.governorAddr) {
    governor = await ethers.getContractAt("Governor", opts.governorAddr);
    log(`Using governor contract at ${opts.governorAddr}`);
  } else {
    governor = await ethers.getContract("Governor");
  }

  log(`Submitting proposal for ${description} to governor ${governor.address}`);
  log(`Args: ${JSON.stringify(proposalArgs, null, 2)}`);
  await withConfirmation(
    governor
      .connect(sDeployer)
      .propose(...proposalArgs, description, await getTxOpts())
  );

  const proposalId = (await governor.proposalCount()).toString();
  log(`Submitted proposal ${proposalId}`);

  log(
    `Next step: call the following methods on the governor at ${governor.address} via multi-sig`
  );
  log(`   queue(${proposalId})`);
  log(`   execute(${proposalId})`);
  log("Done");
};

/**
 * Sanity checks to perform before running the deploy
 */
const sanityCheck = async () => {
  if (isMainnet) {
    const VaultProxy = await ethers.getContract("VaultProxy");
    const VaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      VaultProxy.address
    );

    const vaultGovernor = await VaultAdmin.governor();
    const { governorAddr } = await getNamedAccounts();

    if (vaultGovernor.toLowerCase() !== governorAddr.toLowerCase()) {
      throw new Error(
        `Hardhat environment has ${governorAddr} governor address configured which is different from Vault's governor: ${vaultGovernor}`
      );
    }
  }
};

/**
 * When in forked/fork test environment we want special handling of possibly active proposals:
 * - if node is forked below the proposal block number deploy the migration file
 * - if node is forked after the proposal block number check the status of proposal:
 *   - if proposal executed skip deployment
 *   - if proposal New / Queued execute it and skip deployment
 *
 * @returns bool -> when true the hardhat deployment is skipped
 */
const handlePossiblyActiveProposal = async (
  proposalId,
  deployName,
  governor
) => {
  if (isFork && proposalId) {
    const proposalCount = Number((await governor.proposalCount()).toString());
    // proposal has not yet been submitted on the forked node (with current block height)
    if (proposalCount < proposalId) {
      // execute the whole deployment normally
      console.log(
        `Proposal ${deployName} not yet submitted at this block height. Continue deploy.`
      );
      return false;
    }

    const proposalState = ["New", "Queue", "Expired", "Executed"][
      await governor.state(proposalId)
    ];

    if (["New", "Queue"].includes(proposalState)) {
      console.log(
        `Found proposal id: ${proposalId} on forked network. Executing proposal containing deployment of: ${deployName}`
      );

      // skip queue if proposal is already queued
      await executeProposalOnFork({
        proposalId,
        skipQueue: proposalState === "Queue",
      });

      // proposal executed skip deployment
      return true;
    } else if (proposalState === "Executed") {
      console.log(`Proposal ${deployName} already executed. Nothing to do.`);
      // proposal has already been executed skip deployment
      return true;
    }
  }

  // run deployment
  return false;
};

/**
 * Shortcut to create a deployment for hardhat to use
 * @param {Object} options for deployment
 * @param {Promise<Object>} fn to deploy contracts and return needed proposals
 * @returns {Object} main object used by hardhat
 */
function deploymentWithProposal(opts, fn) {
  const { deployName, dependencies, forceDeploy, forceSkip, proposalId } = opts;
  const runDeployment = async (hre) => {
    const oracleAddresses = await getOracleAddresses(hre.deployments);
    const assetAddresses = await getAssetAddresses(hre.deployments);
    const tools = {
      oracleAddresses,
      assetAddresses,
      deployWithConfirmation,
      ethers,
      getTxOpts,
      withConfirmation,
    };
    const { governorAddr } = await getNamedAccounts();
    const governor = await ethers.getContractAt("Governor", governorAddr);

    // proposal has either been already executed on forked node or just been executed
    // no use of running the deploy script to create another
    if (await handlePossiblyActiveProposal(proposalId, deployName, governor)) {
      return;
    }

    await sanityCheck();
    const proposal = await fn(tools);
    const propDescription = proposal.name;
    const propArgs = await proposeArgs(proposal.actions);
    const propOpts = proposal.opts || {};

    if (isMainnet) {
      // On Mainnet, only propose. The enqueue and execution are handled manually via multi-sig.
      log("Sending proposal to governor...");
      await sendProposal(propArgs, propDescription, propOpts);
      log("Proposal sent.");
    } else if (isFork) {
      // On Fork we can send the proposal then impersonate the guardian to execute it.
      log("Sending and executing proposal...");
      await executeProposal(propArgs, propDescription, propOpts);
      log("Proposal executed.");
    } else {
      const sGovernor = await ethers.provider.getSigner(governorAddr);

      for (const action of proposal.actions) {
        const { contract, signature, args } = action;

        log(`Sending governance action ${signature} to ${contract.address}`);
        await withConfirmation(
          contract
            .connect(sGovernor)
            [signature](...args, await getTxOpts(gasLimit))
        );
        console.log(`... ${signature} completed`);
      }
    }
  };

  const main = async (hre) => {
    console.log(`Running ${deployName} deployment...`);
    if (!hre) {
      hre = require("hardhat");
    }
    await runDeployment(hre);
    console.log(`${deployName} deploy done.`);
    return true;
  };

  main.id = deployName;
  main.dependencies = dependencies;
  if (forceSkip) {
    main.skip = () => true;
  } else if (forceDeploy) {
    main.skip = () => false;
  } else {
    /** Just for context of fork env change the id of the deployment script. This is required
     * in circumstances when:
     * - the deployment script has already been run on the mainnet
     * - proposal has been either "Queued" or is still "New"
     * - all the deployment artifacts and migration information is already present in the repo
     *
     * Problem: as part of normal deployment procedure we want to be able to simulate the
     * execution of a proposal and run all the for tests on top of (after) the proposal execution. But
     * since deployment artifacts are already present and migration file has already been updated
     * the hardhat deploy will skip the deployment file (ignoring even the force deploy/`skip` flags.
     * Skipping the deployment file disables us to identify the New/Queued proposal id and executing it.
     *
     * For that reason for any deployment ran on fork with proposalId we change the id of deployment
     * as a workaround so that Hardhat executes it. If proposal has already been executed the
     * `runDeployment` function will exit without applying the deployment.
     *
     * And we can not package this inside of `skip` function since without this workaround it
     * doesn't even get evaluated.
     */
    if (isFork && proposalId) {
      main.id = `${deployName}_force`;
    }

    main.skip = async () => {
      if (isFork) {
        const networkName = isForkTest ? "hardhat" : "localhost";
        const migrations = require(`./../deployments/${networkName}/.migrations.json`);
        const currentBlock = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlockNumber(currentBlock);

        if (proposalId) {
          return false;
        } else {
          const skip = migrations[deployName] < currentBlock;
          if (!skip) {
            console.log(
              ```Deploy ${deployName} has no proposal id and is deployed on the mainnet 
                 with block number: ${migrations[deployName]} which is higher than forked
                 node block: ${currentBlock}. Applying migration.```
            );
          }
          return skip;
        }
      } else {
        return !isMainnet || isSmokeTest || isFork;
      }
    };
  }
  return main;
}

module.exports = {
  log,
  sleep,
  deployWithConfirmation,
  withConfirmation,
  impersonateGuardian,
  executeProposal,
  executeProposalOnFork,
  sendProposal,
  deploymentWithProposal,
};

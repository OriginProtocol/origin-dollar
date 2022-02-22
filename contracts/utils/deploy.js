//
// Deployment utilities
//

const hre = require("hardhat");
const { utils } = require("ethers");

const {
  advanceTime,
  isMainnet,
  isFork,
  isRinkeby,
  isMainnetOrRinkebyOrFork,
  getOracleAddresses,
  getAssetAddresses,
  isSmokeTest,
} = require("../test/helpers.js");

const {
  assertUpgradeIsSafe,
  storeStorageLayoutForContract,
} = require("../tasks/storageSlots");

const addresses = require("../utils/addresses.js");
const { getTxOpts } = require("../utils/tx");
const { proposeArgs } = require("../utils/governor");

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

function log(msg, deployResult = null) {
  if (isMainnetOrRinkebyOrFork || process.env.VERBOSE) {
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
  if (isMainnet || isRinkeby) {
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
const executeProposalOnFork = async (proposalId, executeGasLimit = null) => {
  if (!isFork) throw new Error("Can only be used on Fork");

  // Get the guardian of the governor and impersonate it.
  const { guardianAddr } = await hre.getNamedAccounts();
  const sGuardian = hre.ethers.provider.getSigner(guardianAddr);
  await impersonateGuardian();

  const governor = await ethers.getContract("Governor");

  console.log("GUARDIAN: ", guardianAddr, governor);
  //First enqueue the proposal, then execute it.
  await withConfirmation(
    governor.connect(sGuardian).queue(proposalId, await getTxOpts())
  );

  log(`Proposal ${proposalId} queued`);

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
 * Shortcut to create a deployment for hardhat to use
 * @param {Object} options for deployment
 * @param {Promise<Object>} fn to deploy contracts and return needed proposals
 * @returns {Object} main object used by hardhat
 */
function deploymentWithProposal(opts, fn) {
  const { deployName, dependencies, forceDeploy } = opts;
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
      // Hardcoding gas estimate on Rinkeby since it fails for an undetermined reason...
      const gasLimit = isRinkeby ? 1000000 : null;

      const { governorAddr } = await getNamedAccounts();
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
  if (forceDeploy) {
    main.skip = () => false;
  } else {
    main.skip = () => !(isMainnet || isRinkeby) || isSmokeTest || isFork;
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

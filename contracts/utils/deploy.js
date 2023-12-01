//
// Deployment utilities
//

const hre = require("hardhat");
const { BigNumber } = require("ethers");

const {
  advanceTime,
  advanceBlocks,
  isMainnet,
  isFork,
  isMainnetOrFork,
  getOracleAddresses,
  getAssetAddresses,
  isSmokeTest,
  isForkTest,
  getBlockTimestamp,
} = require("../test/helpers.js");

const {
  assertUpgradeIsSafe,
  storeStorageLayoutForContract,
} = require("../tasks/storageSlots");

const addresses = require("../utils/addresses.js");
const { getTxOpts } = require("../utils/tx");
const {
  proposeArgs,
  proposeGovernanceArgs,
  accountCanCreateProposal,
} = require("../utils/governor");
const governorFiveAbi = require("../abi/governor_five.json");
const timelockAbi = require("../abi/timelock.json");
const { impersonateAndFund } = require("./signers.js");
const { hardhatSetBalance } = require("../test/_fund.js");
const {
  setStorageAt,
  getStorageAt,
} = require("@nomicfoundation/hardhat-network-helpers");
const { keccak256, defaultAbiCoder } = require("ethers/lib/utils.js");

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
  skipUpgradeSafety = false,
  libraries = {}
) => {
  // check that upgrade doesn't corrupt the storage slots
  if (!skipUpgradeSafety) {
    await assertUpgradeIsSafe(
      hre,
      typeof contract == "string" ? contract : contractName
    );
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
      libraries,
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

const withConfirmation = async (
  deployOrTransactionPromise,
  logContractAbi = false
) => {
  const result = await deployOrTransactionPromise;
  const receipt = await hre.ethers.provider.waitForTransaction(
    result.receipt ? result.receipt.transactionHash : result.hash,
    NUM_CONFIRMATIONS
  );

  // Transaction is initializing upgradeable proxy "initialize(address,address,bytes)"
  // second address parameter is the initial governor
  if (result.data && result.data.startsWith("0xcf7a1d77") && isMainnetOrFork) {
    _verifyProxyInitializedWithCorrectGovernor(result.data);
  }

  if (logContractAbi) {
    let contractInterface = new ethers.utils.Interface(logContractAbi);
    receipt.parsedLogs = receipt.logs.map((log) =>
      contractInterface.parseLog(log)
    );
  }

  result.receipt = receipt;
  return result;
};

const _verifyProxyInitializedWithCorrectGovernor = (transactionData) => {
  const initProxyGovernor = (
    "0x" + transactionData.slice(10 + 64 + 24, 10 + 64 + 64)
  ).toLowerCase();
  if (
    ![
      addresses.mainnet.Timelock.toLowerCase(),
      addresses.mainnet.OldTimelock.toLowerCase(),
    ].includes(initProxyGovernor)
  ) {
    throw new Error(
      `Proxy contract initialised with unexpected governor: ${initProxyGovernor}`
    );
  }
};

/**
 * Impersonate the guardian. Only applicable on Fork.
 */
const impersonateGuardian = async (optGuardianAddr = null) => {
  if (!isFork) {
    throw new Error("impersonateGuardian only works on Fork");
  }

  // If an address is passed, use that otherwise default to
  // the guardian address from the default hardhat accounts.
  const guardianAddr =
    optGuardianAddr || (await hre.getNamedAccounts()).guardianAddr;

  impersonateAndFund(guardianAddr);

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
 *   reduceQueueTime: reduce queue proposal time to 60 seconds
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

  // only works on hardhat network that supports `hardhat_setStorageAt`
  if (opts.reduceQueueTime) {
    log(`Reducing required queue time to 60 seconds`);
    /* contracts/timelock/Timelock.sol storage slot layout:
     * slot[0] address admin
     * slot[1] address pendingAdmin
     * slot[2] uint256 delay
     */
    await setStorageAt(
      governorContract.address,
      "0x2",
      "0x000000000000000000000000000000000000000000000000000000000000003c" // 60 seconds
    );
  } else {
    log(`Setting queue time back to 172800 seconds`);

    /* contracts/timelock/Timelock.sol storage slot layout:
     * slot[0] address admin
     * slot[1] address pendingAdmin
     * slot[2] uint256 delay
     */
    await setStorageAt(
      governorContract.address,
      "0x2",
      "0x000000000000000000000000000000000000000000000000000000000002a300" // 172800 seconds
    );
  }

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

  if (opts.reduceQueueTime) {
    log("Advancing time by 61 seconds for TimeLock delay.");
    await advanceTime(61);
  } else {
    log("Advancing time by 3 days for TimeLock delay.");
    await advanceTime(259200);
  }

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

  log("Advancing time by 3 days for TimeLock delay.");
  await advanceTime(259200);

  await withConfirmation(
    governor
      .connect(sGuardian)
      .execute(proposalId, await getTxOpts(executeGasLimit))
  );
  log(`Proposal ${proposalId} executed`);
};

/**
 * Successfully execute the proposal whether it is in
 * "Pending", "Active" or "Queued" state.
 * Given a proposal Id, enqueues and executes it on OGV Governance.
 * @param {Number} proposalId
 * @returns {Promise<void>}
 */
const executeGovernanceProposalOnFork = async ({
  proposalIdBn,
  proposalState,
  reduceQueueTime,
  executeGasLimit = null,
}) => {
  if (!isFork) throw new Error("Can only be used on Fork");

  // Get the guardian of the governor and impersonate it.
  const multisig5of8 = addresses.mainnet.Guardian;
  const sMultisig5of8 = hre.ethers.provider.getSigner(multisig5of8);
  await impersonateGuardian(multisig5of8);

  const governorFive = await getGovernorFive();
  const timelock = await getTimelock();

  await configureGovernanceContractDurations(reduceQueueTime);

  /* this should "almost" never happen since the votingDelay on the governor
   * contract is set to 1 block
   */
  if (proposalState === "Pending") {
    const votingDelay = Number((await governorFive.votingDelay()).toString());
    log(
      `Advancing ${
        votingDelay + 1
      } blocks to make transaction for from Pending to Active`
    );
    await advanceBlocks(votingDelay + 1);
    proposalState = "Active";
    const newState = await getProposalState(proposalIdBn);
    if (newState !== proposalState) {
      throw new Error(
        `Proposal state should now be "Active" but is ${newState}`
      );
    }
  }

  if (proposalState === "Active") {
    try {
      // vote positively on the proposal
      await governorFive.connect(sMultisig5of8).castVote(proposalIdBn, 1);
    } catch (e) {
      // vote already cast is the only acceptable error
      if (!e.message.includes(`vote already cast`)) {
        throw e;
      }
    }

    let slotKey = keccak256(
      defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [proposalIdBn, 1] // `_proposals` is in slot 1
      )
    );
    const extendedDeadlineSlotKey = keccak256(
      defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [proposalIdBn, 12] // `_extendedDeadlines` is in slot 12
      )
    );

    // Add one to get the `endTime` slot
    slotKey = BigNumber.from(slotKey).add(1);

    const deadline = BigNumber.from(
      await getStorageAt(governorFive.address, slotKey)
    ).toNumber();
    const currentBlock = await hre.ethers.provider.getBlockNumber();
    let blocksToMine = deadline - currentBlock;

    if (blocksToMine > 0) {
      if (reduceQueueTime) {
        blocksToMine = 10;
        await setStorageAt(
          governorFive.address,
          slotKey,
          // Make it queueable in 10 blocks
          currentBlock + blocksToMine
        );
        await setStorageAt(
          governorFive.address,
          extendedDeadlineSlotKey,
          // Make it queueable in 10 blocks
          currentBlock + blocksToMine
        );
      }
      log(
        `Advancing ${blocksToMine} blocks to make transaction for from Active to Succeeded`
      );

      // Advance to the end of voting period
      await advanceBlocks(blocksToMine + 1);
    }

    proposalState = "Succeeded";
    let newState = await getProposalState(proposalIdBn);
    if (newState !== "Succeeded") {
      throw new Error(
        `Proposal state should now be "Succeeded" but is ${newState}`
      );
    }
  }

  if (proposalState === "Succeeded") {
    await governorFive.connect(sMultisig5of8)["queue(uint256)"](proposalIdBn);
    log("Proposal queued");
    newState = await getProposalState(proposalIdBn);
    if (newState !== "Queued") {
      throw new Error(
        `Proposal state should now be "Queued" but is ${newState}`
      );
    }

    proposalState = "Queued";
  }

  log("preparing to execute");
  /* In theory this could fail if proposal is rejected by votes on the mainnet.
   * In that case such proposalId should not be included in migration files
   */
  if (proposalState === "Queued") {
    const timelockId = await getStorageAt(
      governorFive.address,
      keccak256(
        defaultAbiCoder.encode(
          ["uint256", "uint256"],
          [proposalIdBn, 10] // `_timelockIds` is in slot 10
        )
      )
    );

    const minDelaySlot = keccak256(
      defaultAbiCoder.encode(
        ["bytes32", "uint256"],
        [timelockId, 1] // `_timestamps` is in slot 1
      )
    );

    const timelockTimestamp = BigNumber.from(
      await getStorageAt(timelock.address, minDelaySlot)
    ).toNumber();

    const tNow = await getBlockTimestamp();
    let timeToAdvance = timelockTimestamp - tNow;

    if (timeToAdvance > 0) {
      if (reduceQueueTime) {
        // Advance by 30s
        timeToAdvance = 30;

        // Make it executable now
        await setStorageAt(timelock.address, minDelaySlot, tNow - 60);
      }

      log(
        `Advancing to the end of the queue period (on the timelock): ${timeToAdvance}`
      );
      // advance to the end of queue period
      await advanceTime(timeToAdvance + 1);
      await advanceBlocks(2);
    }
  }

  await governorFive.connect(sMultisig5of8)["execute(uint256)"](proposalIdBn, {
    gasLimit: executeGasLimit,
  });

  const newProposalState = await getProposalState(proposalIdBn);
  if (newProposalState === "Executed") {
    log(`Proposal id: ${proposalIdBn.toString()} executed`);
  } else {
    throw new Error(
      `Something is wrong! Proposal id: ${proposalIdBn.toString()} in ${newProposalState} state`
    );
  }
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
 * Builds the governance proposal transaction that is to be submitted via GnosisSafe Interface.
 *
 * @param {Array<Object>} proposalArgs
 * @param {string} description
 * @returns {Promise<void>}
 */
const submitProposalGnosisSafe = async (
  proposalArgs,
  description,
  opts = {}
) => {
  if (!isMainnet) {
    throw new Error("submitProposalGnosisSafe only works on Mainnet");
  }

  const governorFive = await getGovernorFive();

  log(`Submitting proposal for ${description}`);
  log(`Args: ${JSON.stringify(proposalArgs, null, 2)}`);

  const result = await governorFive.populateTransaction[
    "propose(address[],uint256[],string[],bytes[],string)"
  ](...proposalArgs, description, await getTxOpts());

  log(
    `Next step: go to Gnosis Safe Web -> New Transaction -> 👷 Contract Interaction`
  );
  log(`  - enable "Custom Data" toggle`);
  log(`  - set "Enter address or ENS name" to: '${result.to}'`);
  log(`  - set "ETH value" to: 0`);
  log(`  - set "Data (Hex encoded)" to:`);
  log(`${result.data}`);
  log(`  - click on 'Add Transaction'`);
  process.exit();
};

const configureGovernanceContractDurations = async (reduceQueueTime) => {
  const governorFive = await getGovernorFive();
  const timelock = await getTimelock();

  if (reduceQueueTime) {
    log(
      `Reducing required voting delay to 1 block and voting period to 60 blocks ` +
        `vote extension on late vote to 0 and timelock min delay to 5 seconds`
    );

    // slot[4] uint256 votingDelay
    await setStorageAt(
      governorFive.address,
      "0x4",
      "0x0000000000000000000000000000000000000000000000000000000000000001" // 1 block
    );
    // slot[5] uint256 votingPeriod
    await setStorageAt(
      governorFive.address,
      "0x5",
      "0x000000000000000000000000000000000000000000000000000000000000003c" // 60 blocks
    );
    // slot[11]uint256 lateQuoruVoteExtension
    await setStorageAt(
      governorFive.address,
      "0xB", // 11
      "0x0000000000000000000000000000000000000000000000000000000000000000" // 0 blocks
    );
    // slot[2]uint256 _minDelay
    await setStorageAt(
      timelock.address,
      "0x2",
      "0x0000000000000000000000000000000000000000000000000000000000000005" // 5 seconds
    );
  } else {
    log(
      `Setting back original values of required voting delay to 1 block and ` +
        `voting period to 17280 blocks vote extension on late vote to 11520 and ` +
        `timelock min delay to 172800 seconds`
    );

    // slot[4] uint256 votingDelay
    await setStorageAt(
      governorFive.address,
      "0x4",
      "0x0000000000000000000000000000000000000000000000000000000000000001" // 1 block
    );
    // slot[5] uint256 votingPeriod
    await setStorageAt(
      governorFive.address,
      "0x5",
      "0x0000000000000000000000000000000000000000000000000000000000003840" // 14400 blocks
    );
    // slot[11]uint256 lateQuoruVoteExtension
    await setStorageAt(
      governorFive.address,
      "0xB", // 11
      "0x0000000000000000000000000000000000000000000000000000000000001C20" // 7200 blocks
    );
    // slot[2]uint256 _minDelay
    await setStorageAt(
      timelock.address,
      "0x2",
      "0x000000000000000000000000000000000000000000000000000000000002a300" // 172800 seconds
    );
  }
};

/**
 * In forked environment simulated that 5/8 multisig has submitted an OGV
 * governance proposal
 *
 * @param {Array<Object>} proposalArgs
 * @param {string} description
 * @param {opts} Options
 *   reduceQueueTime: reduce queue proposal time to 60 seconds
 * @returns {Promise<void>}
 */
const submitProposalToOgvGovernance = async (
  proposalArgs,
  description,
  opts = {}
) => {
  if (!isFork && !isMainnet) {
    throw new Error(
      "submitProposalToOgvGovernance only works on Fork & Mainnet networks"
    );
  }

  const governorFive = await getGovernorFive();

  log(`Submitting proposal for ${description}`);
  log(`Args: ${JSON.stringify(proposalArgs, null, 2)}`);

  // overridig storage slots needs to/can only run in forked environment
  if (!isMainnet) {
    await configureGovernanceContractDurations(opts.reduceQueueTime);
  }

  let signer;
  // we are submitting proposal using the deployer
  if (isMainnet) {
    const { deployerAddr } = await getNamedAccounts();
    signer = hre.ethers.provider.getSigner(deployerAddr);
  } else {
    const multisig5of8 = addresses.mainnet.Guardian;
    signer = hre.ethers.provider.getSigner(multisig5of8);
    await impersonateGuardian(multisig5of8);
  }
  const result = await withConfirmation(
    governorFive
      .connect(signer)
      ["propose(address[],uint256[],string[],bytes[],string)"](
        ...proposalArgs,
        description,
        await getTxOpts()
      ),
    governorFiveAbi
  );
  const proposalId = result.receipt.parsedLogs[0].args[0].toString();

  log(`Submitted governance proposal to OGV governance ${proposalId}`);
  if (!isMainnet) {
    await advanceBlocks(1);
  }
  const proposalIdBn = BigNumber.from(proposalId);
  const proposalState = await getProposalState(proposalIdBn);

  return {
    proposalState,
    proposalId,
    proposalIdBn,
  };
};

/**
 * Sanity checks to perform before running the deploy
 */
const sanityCheckOgvGovernance = async ({ deployerIsProposer = false }) => {
  if (isMainnet) {
    // only applicable when OGV governance is the governor
    if (deployerIsProposer) {
      const governorFive = await getGovernorFive();
      const { deployerAddr } = await getNamedAccounts();
      if (!(await accountCanCreateProposal(governorFive, deployerAddr))) {
        throw new Error(
          `Deployer ${deployerAddr} doesn't have enough voting power to create a proposal.`
        );
      }
    }

    const VaultProxy = await ethers.getContract("VaultProxy");
    const VaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      VaultProxy.address
    );

    const vaultGovernor = await VaultAdmin.governor();
    const { timelockAddr } = await getNamedAccounts();

    if (vaultGovernor.toLowerCase() !== timelockAddr.toLowerCase()) {
      throw new Error(
        `Hardhat environment has ${timelockAddr} governor address configured which is different from Vault's governor: ${vaultGovernor}`
      );
    }
  }
};

/**
 * When in forked/fork test environment we want special handling of possibly active proposals:
 * - if node is forked below the proposal block number deploy the migration file and execute
 *   the proposal
 * - if node is forked after the proposal block number check the status of proposal:
 *   - if proposal executed skip deployment
 *   - if proposal Pending / Active / Queued execute it and skip deployment
 *
 * @returns bool -> when true the hardhat deployment is skipped
 */
const handlePossiblyActiveGovernanceProposal = async (
  proposalId,
  deployName,
  governorFive,
  reduceQueueTime,
  executeGasLimit
) => {
  if (isFork && proposalId) {
    let proposalState;
    let proposalIdBn = ethers.BigNumber.from(proposalId);
    try {
      proposalState = await getProposalState(proposalIdBn);
    } catch (e) {
      // If proposal is non existent the governor reverts the transaction
      if (
        e.message.includes("invalid proposal id") ||
        e.message.includes("unknown proposal id")
      ) {
        proposalState = false;
      } else {
        throw e;
      }
    }

    // proposal has not yet been submitted on the forked node (with current block height)
    if (proposalState == false) {
      // execute the whole deployment normally
      console.log(
        `Proposal ${deployName} not yet submitted at this block height. Continue deploy.`
      );
      return false;
    }

    if (["Pending", "Active", "Succeeded", "Queued"].includes(proposalState)) {
      console.log(
        `Found proposal id: ${proposalId} on forked network with ${proposalState} state. Executing proposal containing deployment of: ${deployName}`
      );

      await executeGovernanceProposalOnFork({
        proposalIdBn,
        proposalState,
        reduceQueueTime,
        executeGasLimit,
      });

      // proposal executed skip deployment
      return true;
    } else if (
      ["Executed", "Expired", "Canceled", "Defeated"].includes(proposalState)
    ) {
      console.log(
        `Proposal ${deployName} is in ${proposalState} state. Nothing to do.`
      );
      return true;
    }
  }

  // run deployment
  return false;
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
  governor,
  reduceQueueTime
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

      await configureGovernanceContractDurations(reduceQueueTime);

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

async function getGovernorFive() {
  const { governorFiveAddr } = await getNamedAccounts();

  return new ethers.Contract(
    governorFiveAddr,
    governorFiveAbi,
    hre.ethers.provider
  );
}

async function getProposalState(proposalIdBn) {
  const governorFive = await getGovernorFive();
  let state = -1;
  /* Sometimes a bug happens where fetching the state will cause an exception. It doesn't happen
   * if deploy is ran with "--trace" option. A workaround that doesn't fix the unknown underlying
   * issue is to retry 3 times.
   */
  let tries = 3;
  while (tries > 0) {
    tries--;
    try {
      state = await governorFive.state(proposalIdBn);
      tries = 0;
    } catch (e) {}
  }

  return [
    "Pending",
    "Active",
    "Canceled",
    "Defeated",
    "Succeeded",
    "Queued",
    "Expired",
    "Executed",
  ][state];
}

async function getTimelock() {
  const { timelockAddr } = await getNamedAccounts();

  return new ethers.Contract(timelockAddr, timelockAbi, hre.ethers.provider);
}

/**
 * Shortcut to create a deployment on decentralized Governance (OGV) for hardhat to use
 * @param {Object} options for deployment
 * @param {Promise<Object>} fn to deploy contracts and return needed proposals
 * @returns {Object} main object used by hardhat
 */
function deploymentWithGovernanceProposal(opts, fn) {
  const {
    deployName,
    dependencies,
    forceDeploy,
    onlyOnFork,
    forceSkip,
    proposalId,
    deployerIsProposer = false, // The deployer issues the propose to OGV Governor
    reduceQueueTime = false, // reduce governance queue times
    executeGasLimit = null,
  } = opts;
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

    const governorFive = await getGovernorFive();

    /* Proposal has either:
     *  - already been executed before running this function or
     *  - been executed by running this function
     *  - is in one of the states that can't get to execution: "Expired", "Canceled", "Defeated"
     */
    if (
      await handlePossiblyActiveGovernanceProposal(
        proposalId,
        deployName,
        governorFive,
        reduceQueueTime,
        executeGasLimit
      )
    ) {
      return;
    }

    await sanityCheckOgvGovernance({ deployerIsProposer });

    const proposal = await fn(tools);
    const propDescription = proposal.name;
    const propArgs = await proposeGovernanceArgs(proposal.actions);
    const propOpts = proposal.opts || {};

    if (isMainnet) {
      // On Mainnet, only build the propose transaction for OGV governance
      log("Building OGV governance proposal...");
      if (deployerIsProposer) {
        await submitProposalToOgvGovernance(
          propArgs,
          propDescription,
          propOpts
        );
      } else {
        await submitProposalGnosisSafe(propArgs, propDescription, propOpts);
      }
      log("Proposal sent.");
    } else if (isFork) {
      // On Fork we can send the proposal then impersonate the guardian to execute it.
      log("Sending the governance proposal to OGV governance");
      propOpts.reduceQueueTime = reduceQueueTime;
      const { proposalState, proposalId, proposalIdBn } =
        await submitProposalToOgvGovernance(
          propArgs,
          propDescription,
          propOpts
        );
      log("Executing the proposal");
      await executeGovernanceProposalOnFork({
        proposalIdBn,
        proposalState,
        reduceQueueTime,
        executeGasLimit,
      });
      log("Proposal executed.");
    } else {
      throw new Error(
        "deploymentWithGovernanceProposal not supported in local node environment"
      );
    }
  };

  const main = async (hre) => {
    console.log(`Running ${deployName} deployment...`);
    if (!hre) {
      hre = require("hardhat");
    }
    if (isFork) {
      const { deployerAddr } = await getNamedAccounts();
      await hardhatSetBalance(deployerAddr, "1000000");
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
    const networkName = isForkTest ? "hardhat" : "localhost";
    const migrations = isForkTest
      ? require(`./../deployments/${networkName}/.migrations.json`)
      : {};

    if (isFork && proposalId) {
      // Skip if proposal is older than 14 days
      const olderProposal =
        Date.now() / 1000 - migrations[deployName] >= 60 * 60 * 24 * 14;

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
       * Skipping the deployment file prevents us to identify the New/Queued proposal id and executing it.
       *
       * For that reason for any deployment ran on fork with proposalId we change the id of deployment
       * as a workaround so that Hardhat executes it. If proposal has already been executed the
       * `runDeployment` function will exit without applying the deployment.
       *
       * And we can not package this inside of `skip` function since without this workaround it
       * doesn't even get evaluated.
       */
      if (!olderProposal) {
        // We skip force running deployments that have been run
        // more than 14 days ago on mainnet with a governance proposal.
        // Any deployment without a proposal, which has not been run yet,
        // will still be force run on fork.
        main.id = `${deployName}_force`;
      }
    }

    main.skip = async () => {
      // running on fork with a proposalId already available
      if (isFork && proposalId) {
        return false;
      } else if (isFork) {
        /* running on fork, and proposal not yet submitted. This is usually during development
         * before kicking off deploy.
         */
        return Boolean(migrations[deployName]);
      } else {
        return onlyOnFork ? true : !isMainnet || isSmokeTest;
      }
    };
  }
  return main;
}

/**
 * Shortcut to create a deployment for hardhat to use
 * @param {Object} options for deployment
 * @param {Promise<Object>} fn to deploy contracts and return needed proposals
 * @returns {Object} main object used by hardhat
 */
function deploymentWithProposal(opts, fn) {
  /* When `reduceQueueTime` is set to true the Timelock delay is overriden to
   * 60 seconds and blockchain also advances only minimally when passing proposals.
   *
   * This is required because in some cases we need minimal chain advancement e.g.
   * when Oracle data would become stale too quickly.
   */
  const {
    deployName,
    dependencies,
    forceDeploy,
    forceSkip,
    onlyOnFork,
    proposalId,
    reduceQueueTime,
  } = opts;
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
    if (
      await handlePossiblyActiveProposal(
        proposalId,
        deployName,
        governor,
        reduceQueueTime
      )
    ) {
      return;
    }

    await sanityCheckOgvGovernance();
    const proposal = await fn(tools);
    if (proposal.actions.length == 0) {
      return; // No governance proposal
    }
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
      propOpts.reduceQueueTime = reduceQueueTime;
      await executeProposal(propArgs, propDescription, propOpts);
      log("Proposal executed.");
    } else {
      const sGovernor = await ethers.provider.getSigner(governorAddr);

      for (const action of proposal.actions) {
        const { contract, signature, args } = action;

        log(`Sending governance action ${signature} to ${contract.address}`);
        await withConfirmation(
          contract.connect(sGovernor)[signature](...args, await getTxOpts())
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
     * Skipping the deployment file prevents us to identify the New/Queued proposal id and executing it.
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
      // running on fork with a proposalId already available
      if (isFork && proposalId) {
        return false;
        /* running on fork, and proposal not yet submitted. This is usually during development
         * before kicking off deploy.
         */
      } else if (isFork) {
        const networkName = isForkTest ? "hardhat" : "localhost";
        const migrations = require(`./../deployments/${networkName}/.migrations.json`);
        return Boolean(migrations[deployName]);
      } else {
        return onlyOnFork ? true : !isMainnet || isSmokeTest;
      }
    };
  }
  return main;
}

/**
 * Shortcut to create a deployment for hardhat to use where 5/8 multisig is the
 * governor
 * @param {Object} options for deployment
 * @param {Promise<Object>} fn to deploy contracts and return needed proposals
 * @returns {Object} main object used by hardhat
 */
function deploymentWithGuardianGovernor(opts, fn) {
  const { deployName, dependencies, forceDeploy, onlyOnFork, forceSkip } = opts;
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

    await sanityCheckOgvGovernance();
    const proposal = await fn(tools);
    const propDescription = proposal.name;

    if (isMainnet) {
      // On Mainnet, only propose. The enqueue and execution are handled manually via multi-sig.
      console.log(
        "Manually create the 5/8 multisig batch transaction with details:",
        proposal
      );
    } else {
      const guardianAddr = addresses.mainnet.Guardian;
      await impersonateGuardian(guardianAddr);

      const sGuardian = await ethers.provider.getSigner(guardianAddr);
      console.log("guardianAddr", guardianAddr);

      const guardianActions = [];
      for (const action of proposal.actions) {
        const { contract, signature, args } = action;

        log(`Sending governance action ${signature} to ${contract.address}`);
        const result = await withConfirmation(
          contract.connect(sGuardian)[signature](...args, await getTxOpts())
        );
        guardianActions.push({
          sig: signature,
          args: args,
          to: contract.address,
          data: result.data,
          value: result.value.toString(),
        });

        console.log(`... ${signature} completed`);
      }

      console.log(
        "Execute the following actions using guardian safe: ",
        guardianActions
      );
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
    main.skip = async () => {
      if (isFork) {
        const networkName = isForkTest ? "hardhat" : "localhost";
        const migrations = require(`./../deployments/${networkName}/.migrations.json`);
        return Boolean(migrations[deployName]);
      } else {
        return onlyOnFork ? true : !isMainnet || isSmokeTest;
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
  deploymentWithGovernanceProposal,
  deploymentWithGuardianGovernor,
};

//
// Deployment utilities
//

const hre = require("hardhat");
const { utils } = require("ethers");

const {
  isMainnet,
  isFork,
  isRinkeby,
  isMainnetOrRinkebyOrFork,
} = require("../test/helpers.js");

const {
  assertUpgradeIsSafe,
  storeStorageLayoutForContract,
} = require("../tasks/storageSlots");

const addresses = require("../utils/addresses.js");
const { getTxOpts } = require("../utils/tx");

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

const deployWithConfirmation = async (contractName, args, contract) => {
  // check that upgrade doesn't corrupt the storage slots
  await assertUpgradeIsSafe(hre, contractName);

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
const impersonateGuardian = async () => {
  if (!isFork) {
    throw new Error("impersonateGuardian only works on Fork");
  }

  const { guardianAddr } = await hre.getNamedAccounts();

  // Send some ETH to the Guardian account to pay for gas fees.
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [addresses.mainnet.Binance],
  });
  const binanceSigner = await hre.ethers.provider.getSigner(
    addresses.mainnet.Binance
  );
  await binanceSigner.sendTransaction({
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
 * @param {boolean} whether to use the V1 governor (e.g. MinuteTimelock)
 * @returns {Promise<void>}
 */
const executeProposal = async (proposalArgs, description, v1 = false) => {
  if (isMainnet || isRinkeby) {
    throw new Error("executeProposal only works on local test network");
  }

  const { deployerAddr, guardianAddr } = await hre.getNamedAccounts();
  const sGuardian = hre.ethers.provider.getSigner(guardianAddr);
  const sDeployer = hre.ethers.provider.getSigner(deployerAddr);

  if (isFork) {
    await impersonateGuardian();
  }

  let governorContract;
  if (v1) {
    const v1GovernorAddr = "0x8a5fF78BFe0de04F5dc1B57d2e1095bE697Be76E";
    const v1GovernorAbi = [
      "function propose(address[],uint256[],string[],bytes[],string) returns (uint256)",
      "function proposalCount() view returns (uint256)",
      "function queue(uint256)",
      "function execute(uint256)",
    ];
    proposalArgs = [proposalArgs[0], [0], proposalArgs[1], proposalArgs[2]];
    governorContract = new ethers.Contract(
      v1GovernorAddr,
      v1GovernorAbi,
      hre.ethers.provider
    );
    log(`Using V1 governor contract at ${v1GovernorAddr}`);
  } else {
    governorContract = await ethers.getContract("Governor");
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

  log("Waiting for TimeLock delay. Sleeping for 61 seconds...");
  await sleep(61000);

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

  //First enqueue the proposal, then execute it.
  await withConfirmation(
    governor.connect(sGuardian).queue(proposalId, await getTxOpts())
  );
  log(`Proposal ${proposalId} queued`);

  log("Waiting for TimeLock delay. Sleeping for 61 seconds...");
  await sleep(61000);

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
const sendProposal = async (proposalArgs, description) => {
  if (!isMainnet && !isFork) {
    throw new Error("sendProposal only works on Mainnet and Fork networks");
  }

  const { deployerAddr } = await hre.getNamedAccounts();
  const sDeployer = hre.ethers.provider.getSigner(deployerAddr);

  const governor = await ethers.getContract("Governor");

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

module.exports = {
  log,
  sleep,
  deployWithConfirmation,
  withConfirmation,
  impersonateGuardian,
  executeProposal,
  executeProposalOnFork,
  sendProposal,
};

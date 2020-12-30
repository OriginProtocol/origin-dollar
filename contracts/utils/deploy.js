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
const addresses = require("../utils/addresses.js");
const { getTxOpts } = require("../utils/tx")

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
      ...(await getTxOpts())
    })
  );
  log(`Deployed ${contractName}`, result);
  return result;
};

const withConfirmation = async (deployOrTransactionPromise) => {
  const result = await deployOrTransactionPromise;
  await ethers.provider.waitForTransaction(
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
  const binanceSigner = await ethers.provider.getSigner(
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
const executeProposal = async (proposalArgs, description, v1=false) => {
  if (isMainnet || isRinkeby) {
    throw new Error("executeProposal only works on local test network");
  }

  const { deployerAddr, guardianAddr } = await hre.getNamedAccounts();
  const sGuardian = ethers.provider.getSigner(guardianAddr);
  const sDeployer = ethers.provider.getSigner(deployerAddr);

  if (isFork) {
    await impersonateGuardian();
  }

  let governorContract
  if (v1) {
    const v1GovernorAddr = "0x8a5fF78BFe0de04F5dc1B57d2e1095bE697Be76E"
    const v1GovernorAbi = [
      "function propose(address[],uint256[],string[],bytes[],string) returns (uint256)",
      "function proposalCount() view returns (uint256)",
      "function queue(uint256)",
      "function execute(uint256)"
    ]
    proposalArgs = [ proposalArgs[0], [0], proposalArgs[1], proposalArgs[2]]
    governorContract = new ethers.Contract(v1GovernorAddr, v1GovernorAbi, hre.ethers.provider);
    log(`Using V1 governor contract at ${v1GovernorAddr}`)
  } else {
    governorContract = await ethers.getContract("Governor");
  }

  const txOpts = await getTxOpts()

  log(`Submitting proposal for ${description}`);
  await withConfirmation(
    governorContract.connect(sDeployer).propose(...proposalArgs, description, txOpts)
  );
  const proposalId = await governorContract.proposalCount();
  log(`Submitted proposal ${proposalId}`);

  await governorContract.connect(sGuardian).queue(proposalId, txOpts);
  log(`Proposal ${proposalId} queued`)

  log("Waiting for TimeLock delay. Sleeping for 61 seconds...");
  await sleep(61000);

  await withConfirmation(governorContract.connect(sGuardian).execute(proposalId, txOpts));
  log("Proposal executed");
};

module.exports = {
  log,
  sleep,
  deployWithConfirmation,
  withConfirmation,
  impersonateGuardian,
  executeProposal,
};

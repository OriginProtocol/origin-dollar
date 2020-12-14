//
// Deployment utilities
//

const hre = require("hardhat");
const { utils } = require("ethers");

const { isMainnet, isFork, isRinkeby, isMainnetOrRinkebyOrFork } = require("../test/helpers.js");
const addresses = require("../utils/addresses.js");


// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

function log(msg, deployResult = null) {
  if (isMainnetOrRinkebyOrFork || process.env.VERBOSE) {
    if (deployResult) {
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
  if (!contract) contract = contractName;
  const result = await withConfirmation(
    deploy(contractName, {
      from: deployerAddr,
      args,
      contract,
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
 * Impersonate the governor. Only applicable on Fork.
 */
const impersonateGovernor = async() => {
  if (!isFork) {
    throw new Error("impersonateGovernor only works on Fork")
  }

  const { governorAddr } = await hre.getNamedAccounts();

  // Send some ETH to Governor to pay for gas fees.
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [addresses.mainnet.Binance],
  });
  const binanceSigner = await ethers.provider.getSigner(
    addresses.mainnet.Binance
  );
  await binanceSigner.sendTransaction({
    to: governorAddr,
    value: utils.parseEther("100"),
  });

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [governorAddr],
  });
  log(`Impersonated Governor at ${governorAddr}`)
}

/**
 * Execute a proposal on local test network.
 *
 * @param {Array<Object>} proposalArgs
 * @param {string} description
 * @returns {Promise<void>}
 */
const executeProposal = async(proposalArgs, description) => {
  if (isMainnetOrRinkebyOrFork) {
    throw new Error("executeProposal only works on local test network")
  }

  const { governorAddr, deployerAddr } = await hre.getNamedAccounts();
  const sGovernor = ethers.provider.getSigner(governorAddr);
  const sDeployer = ethers.provider.getSigner(deployerAddr);
  const sGuardian = sGovernor;

  const governorContract = await ethers.getContract("Governor");

  log(`Submitting proposal for ${description}`);

  await withConfirmation(
    governorContract.connect(sDeployer).propose(...proposalArgs, description)
  );
  const proposalId = await governorContract.proposalCount();
  log(`Submitted proposal ${proposalId}`);

  log("Queueing proposal...");
  await governorContract.connect(sGuardian).queue(proposalId);
  log("Waiting for TimeLock. Sleeping for 61 seconds...");
  await sleep(61000);

  await withConfirmation(governorContract.connect(sDeployer).execute(proposalId));
  log("Proposal executed");
}

module.exports = {
  log,
  sleep,
  deployWithConfirmation,
  withConfirmation,
  impersonateGovernor,
  executeProposal,
};

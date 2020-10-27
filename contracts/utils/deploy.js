const { isMainnet, isRinkeby } = require("../test/helpers.js");
const { getTxOpts } = require("../utils/tx");

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

function log(msg, totalDeployGasUsed, deployResult = null) {
  if (isMainnet || isRinkeby || process.env.VERBOSE) {
    if (deployResult) {
      const gasUsed = Number(deployResult.receipt.gasUsed.toString());
      totalDeployGasUsed += gasUsed;
      msg += ` Address: ${deployResult.address} Gas Used: ${gasUsed}`;
    }
    console.log("INFO:", msg);
  }
}

const deployWithConfirmation = async (contractName, args = [], contract) => {
  const { deploy } = deployments;
  const { deployerAddr } = await getNamedAccounts();
  if (!contract) contract = contractName;
  const result = await withConfirmation(
    deploy(contractName, {
      from: deployerAddr,
      args,
      contract,
      ...(await getTxOpts()),
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

module.exports = {
  log,
  deployWithConfirmation,
  withConfirmation,
};

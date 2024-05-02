const { resolveContract } = require("../utils/resolvers");
const { ethereumAddress } = require("../utils/regex");
const { getSigner } = require("../utils/signers");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:governable");

async function governor(taskArguments) {
  const { name } = taskArguments;
  const signer = await getSigner();

  const contract = await resolveContract(name, "Governable");

  const governor = await contract.connect(signer).governor();
  console.log(`Governor for ${name} is ${governor}`);
}

async function transferGovernance(taskArguments) {
  const { proxy, governor } = taskArguments;
  const signer = await getSigner();

  const contract = await resolveContract(proxy, "Governable");

  if (!governor.match(ethereumAddress)) {
    throw new Error(`Invalid governor address: ${governor}`);
  }

  log(`About to transfer governance for ${proxy} to ${governor}`);
  const tx = await contract.connect(signer).transferGovernance(governor);
  await logTxDetails(tx, "transferGovernance");
}

async function claimGovernance(taskArguments) {
  const { proxy } = taskArguments;
  const signer = await getSigner();

  const governable = await resolveContract(proxy, "Governable");

  log(`About to claim governance for ${proxy}`);
  const tx = await governable.connect(signer).claimGovernance();
  await logTxDetails(tx, "claimGovernance");
}

module.exports = {
  transferGovernance,
  claimGovernance,
  governor,
};

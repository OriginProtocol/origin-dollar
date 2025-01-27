const { resolveContract } = require("../utils/resolvers");
const { getSigner } = require("../utils/signers");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:tokens");

async function setDefaultValidator({ id }) {
  const signer = await getSigner();

  const strategy = await resolveContract(
    `SonicStakingStrategyProxy`,
    "SonicStakingStrategy"
  );

  log(`About to setDefaultValidatorId to ${id}`);
  const tx = await strategy.connect(signer).setDefaultValidatorId(id);
  await logTxDetails(tx, "setDefaultValidatorId");
}

module.exports = {
  setDefaultValidator,
};

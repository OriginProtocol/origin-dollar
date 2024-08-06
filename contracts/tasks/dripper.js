const { resolveContract } = require("../utils/resolvers");
const { getSigner } = require("../utils/signers");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:vault");

async function getContract(symbol) {
  const contractPrefix = symbol === "OUSD" ? "" : symbol;
  const dripper = await resolveContract(
    `${contractPrefix}DripperProxy`,
    "IDripper"
  );

  return dripper;
}

async function setDripDuration({ symbol, duration }) {
  const signer = await getSigner();

  const dripper = await getContract(symbol);

  log(`About setDripDuration to ${duration} seconds on the ${symbol} Dripper`);
  const tx = await dripper.connect(signer).setDripDuration(duration);
  await logTxDetails(tx, "setDripDuration");
}

async function collect({ symbol }) {
  const signer = await getSigner();

  const dripper = await getContract(symbol);

  log(`About collect from the ${symbol} Dripper`);
  const tx = await dripper.connect(signer).collect();
  await logTxDetails(tx, "collect");
}

module.exports = {
  collect,
  setDripDuration,
};

const { resolveContract } = require("../utils/resolvers");
const { getSigner } = require("../utils/signers");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:harvest");

async function harvestAndSwap({ strategy, harvester }) {
  const signer = await getSigner();

  const harvesterContract = await resolveContract(harvester, "OETHHarvester");
  const strategyContract = await resolveContract(strategy);

  log(`Harvesting and swapping for strategy ${strategyContract.address}`);
  const tx = await harvesterContract.connect(signer)[
    // eslint-disable-next-line no-unexpected-multiline
    "harvestAndSwap(address)"
  ](strategyContract.address);
  await logTxDetails(tx, "harvestAndSwap");
}

module.exports = {
  harvestAndSwap,
};

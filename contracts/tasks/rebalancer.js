const { getSigner } = require("../utils/signers");
const { computeAllocationsForRebalance } = require("../utils/rebalancer");

async function rebalancerTask() {
  const signer = await getSigner();
  await computeAllocationsForRebalance(signer);
}

module.exports = {
  rebalancerTask,
};

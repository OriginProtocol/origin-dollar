const { getSigner } = require("../utils/signers");
const { buildRebalancePlan } = require("../utils/rebalancer");

async function rebalancerTask() {
  const signer = await getSigner();
  await buildRebalancePlan(signer);
}

module.exports = {
  rebalancerTask,
};

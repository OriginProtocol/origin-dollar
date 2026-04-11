const { buildRebalancePlan } = require("../utils/rebalancer");

async function rebalancerTask() {
  await buildRebalancePlan();
}

module.exports = {
  rebalancerTask,
};

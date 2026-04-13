const { buildRebalancePlan } = require("../utils/rebalancer");

async function rebalancerTask(taskArgs) {
  const { simVault, simEth, simBase, simHyper } = taskArgs;
  const simulation = {};
  if (simVault != null) simulation.vault = simVault;
  if (simEth != null) simulation["Ethereum Morpho"] = simEth;
  if (simBase != null) simulation["Base Morpho"] = simBase;
  if (simHyper != null) simulation["HyperEVM Morpho"] = simHyper;

  await buildRebalancePlan(
    Object.keys(simulation).length > 0 ? simulation : undefined
  );
}

module.exports = {
  rebalancerTask,
};

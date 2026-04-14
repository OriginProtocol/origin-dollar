const fs = require("fs");
const path = require("path");
const { formatUnits } = require("ethers/lib/utils");
const { buildRebalancePlan } = require("../utils/rebalancer");

const USDC_DECIMALS = 6;

async function rebalancerTask(taskArgs) {
  const { simVault, simEth, simBase, simHyper, json } = taskArgs;
  const simulation = {};
  if (simVault != null) simulation.vault = simVault;
  if (simEth != null) simulation["Ethereum Morpho"] = simEth;
  if (simBase != null) simulation["Base Morpho"] = simBase;
  if (simHyper != null) simulation["HyperEVM Morpho"] = simHyper;

  const result = await buildRebalancePlan(
    Object.keys(simulation).length > 0 ? simulation : undefined
  );

  if (json) {
    writeJsonOutput(result, json);
  }
}

function writeJsonOutput(result, outputPath) {
  const { actions, idealActions, state } = result;

  const totalCapital = idealActions.reduce(
    (sum, a) => sum.add(a.balance),
    state.vaultBalance
  );
  const totalNum = parseFloat(formatUnits(totalCapital, USDC_DECIMALS));

  // Use idealActions for targets/APYs, look up feasible actions for impact data
  const actionsByAddr = new Map(actions.map((a) => [a.address, a]));

  const strategies = idealActions.map((a) => {
    const feasible = actionsByAddr.get(a.address);
    const recTarget =
      feasible && feasible.action !== "none"
        ? feasible.targetBalance
        : a.balance;
    const balanceNum = parseFloat(formatUnits(a.balance, USDC_DECIMALS));
    const targetNum = parseFloat(formatUnits(recTarget, USDC_DECIMALS));

    return {
      name: a.name,
      currentBalance: balanceNum,
      currentPct: totalNum > 0 ? (balanceNum / totalNum) * 100 : 0,
      targetBalance: targetNum,
      targetPct: totalNum > 0 ? (targetNum / totalNum) * 100 : 0,
      delta: targetNum - balanceNum,
      avgApy: a.apy,
      spotApy: a.spotApy,
      expectedApy: feasible?.expectedApy ?? null,
      impactBps: feasible?.impactBps ?? null,
    };
  });

  // Vault (idle) row
  const netDelta = actions
    .filter((a) => a.action === "deposit" || a.action === "withdraw")
    .reduce((sum, a) => sum.add(a.delta), require("ethers").BigNumber.from(0));
  const vaultTarget = state.vaultBalance.sub(netDelta);
  const vaultBalanceNum = parseFloat(
    formatUnits(state.vaultBalance, USDC_DECIMALS)
  );
  const vaultTargetNum = parseFloat(formatUnits(vaultTarget, USDC_DECIMALS));

  const output = {
    timestamp: Date.now(),
    totalCapital: totalNum,
    strategies,
    vault: {
      currentBalance: vaultBalanceNum,
      currentPct: totalNum > 0 ? (vaultBalanceNum / totalNum) * 100 : 0,
      targetBalance: vaultTargetNum,
      targetPct: totalNum > 0 ? (vaultTargetNum / totalNum) * 100 : 0,
    },
  };

  // Atomic write: write to .tmp then rename
  const tmpPath = outputPath + ".tmp";
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify(output, null, 2));
  fs.renameSync(tmpPath, outputPath);
  console.log(`JSON output written to ${outputPath}`);
}

module.exports = {
  rebalancerTask,
};

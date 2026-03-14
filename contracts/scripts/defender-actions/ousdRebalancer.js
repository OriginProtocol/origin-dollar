const { ethers } = require("ethers");
const { Defender } = require("@openzeppelin/defender-sdk");
const { parseUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { logTxDetails } = require("../../utils/txLogger");
const { buildRebalancePlan } = require("../../utils/rebalancer");

const log = require("../../utils/logger")("action:ousdRebalancer");

// Maximum amount for any single cross-chain transfer (CCTP bridge limit)
const CROSS_CHAIN_BRIDGE_LIMIT = parseUnits("10000000", 6); // 10M USDC

const rebalancerModuleAbi = [
  "function processWithdrawals(address[] calldata, uint256[] calldata) external",
  "function processDeposits(address[] calldata, uint256[] calldata) external",
  "function processWithdrawalsAndDeposits(address[] calldata, uint256[] calldata, address[] calldata, uint256[] calldata) external",
];

// Return the action amount, capping cross-chain moves at the bridge limit
const actionAmount = (a) => {
  const amt = a.delta.abs();
  return a.isCrossChain && amt.gt(CROSS_CHAIN_BRIDGE_LIMIT)
    ? CROSS_CHAIN_BRIDGE_LIMIT
    : amt;
};

// Entrypoint for the Defender Action
const handler = async (event) => {
  const client = new Defender(event);
  const provider = client.relaySigner.getProvider({ ethersVersion: "v5" });
  const signer = await client.relaySigner.getSigner(provider, {
    speed: "fastest",
    ethersVersion: "v5",
  });

  const { chainId } = await provider.getNetwork();
  if (chainId !== 1) {
    throw new Error(`Action must run on mainnet, not chainId ${chainId}`);
  }

  // Compute off-chain recommendations (also prints the allocation table to logs)
  const { actions: allActions } = await buildRebalancePlan(provider);
  const actions = allActions.filter((a) => !a.isAmo && a.action !== "none");

  if (actions.length === 0) {
    log("No rebalancing actions required");
    return;
  }

  const withdrawals = actions.filter((a) => a.action === "withdraw");
  const deposits = actions.filter((a) => a.action === "deposit");

  const rebalancerModule = new ethers.Contract(
    addresses.mainnet.OUSDRebalancerModule,
    rebalancerModuleAbi,
    signer
  );

  const hasCrossChainWithdrawal = withdrawals.some((a) => a.isCrossChain);

  if (hasCrossChainWithdrawal) {
    // Cross-chain withdrawals are async (bridge settlement takes time).
    // Defer all deposits until the next run after the bridge confirms.
    log("Cross-chain withdrawal present — queueing withdrawals only");
    const tx = await rebalancerModule.processWithdrawals(
      withdrawals.map((a) => a.address),
      withdrawals.map(actionAmount)
    );
    await logTxDetails(tx, "processWithdrawals");
  } else if (withdrawals.length > 0 && deposits.length > 0) {
    // All withdrawals are same-chain: freed USDC lands in the vault immediately,
    // so withdrawals and deposits can be batched into a single transaction.
    log("All-sync rebalance — processing withdrawals and deposits together");
    const tx = await rebalancerModule.processWithdrawalsAndDeposits(
      withdrawals.map((a) => a.address),
      withdrawals.map(actionAmount),
      deposits.map((a) => a.address),
      deposits.map(actionAmount)
    );
    await logTxDetails(tx, "processWithdrawalsAndDeposits");
  } else if (withdrawals.length > 0) {
    log("Queueing withdrawals only");
    const tx = await rebalancerModule.processWithdrawals(
      withdrawals.map((a) => a.address),
      withdrawals.map(actionAmount)
    );
    await logTxDetails(tx, "processWithdrawals");
  } else {
    log("Queueing deposits only");
    const tx = await rebalancerModule.processDeposits(
      deposits.map((a) => a.address),
      deposits.map(actionAmount)
    );
    await logTxDetails(tx, "processDeposits");
  }
};

module.exports = { handler };

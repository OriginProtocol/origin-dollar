const { BigNumber } = require("ethers");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const log = require("../utils/logger")("utils:vault");

/**
 * @returns the WETH available in the vault = WETH balance - withdrawals queued + withdrawals claimed
 */
async function calcAvailableInVault({ weth, vault, blockTag }) {
  const wethInVault = await weth.balanceOf(vault.address, { blockTag });
  log(`WETH balance in vault ${formatUnits(wethInVault, 18)}`);

  const vaultWithdrawals = await vault.withdrawalQueueMetadata({ blockTag });

  const availableInVault = wethInVault
    .sub(vaultWithdrawals.queued)
    .add(vaultWithdrawals.claimed);
  log(`WETH available in vault ${formatUnits(availableInVault, 18)}`);

  return availableInVault;
}

/**
 * Sums the pending partial withdrawals for a set of validator indexes
 * @param {*} stateView
 * @param {*} validatorIndexes array of validator indexes to check for pending partial withdrawals
 * @returns the total amount to 18 decimal places
 */
async function totalPartialWithdrawals(
  stateView,
  validatorIndexes,
  display = false
) {
  // Either log to console or to the logger
  const output = display ? console.log : log;

  output(
    `\nPending partial withdrawals for validators: ${validatorIndexes.join(
      ", "
    )}`
  );

  // Iterate over the pending partial withdrawals
  let totalGwei = BigNumber.from(0);
  let count = 0;
  for (let i = 0; i < stateView.pendingPartialWithdrawals.length; i++) {
    const withdrawal = stateView.pendingPartialWithdrawals.get(i);

    if (validatorIndexes.includes(withdrawal.validatorIndex)) {
      output(
        `  ${formatUnits(withdrawal.amount, 9)} ETH from validator index ${
          withdrawal.validatorIndex
        }, withdrawable epoch ${withdrawal.withdrawableEpoch}`
      );
      totalGwei = totalGwei.add(withdrawal.amount);
      count++;
    }
  }
  output(
    `${count} of ${
      stateView.pendingPartialWithdrawals.length
    } pending partial withdrawals from beacon chain totalling ${formatUnits(
      totalGwei,
      9
    )} ETH`
  );

  // Scale up to 18 decimals
  return parseUnits(totalGwei.toString(), 9);
}

module.exports = {
  calcAvailableInVault,
  totalPartialWithdrawals,
};

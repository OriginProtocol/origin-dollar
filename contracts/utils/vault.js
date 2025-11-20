const { formatUnits } = require("ethers/lib/utils");

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

module.exports = {
  calcAvailableInVault,
};

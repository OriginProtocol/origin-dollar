# -------------------------------------
# May 2, 2025 - Deposit funds back to the Morpho Vaults
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    txs.append(vault_core.rebase(std))

    txs.append(vault_value_checker.takeSnapshot(std))

    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_META_USDC_STRAT,
        [usdc],
        [2_825_586 * 10**6],
        std
      )
    )

    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_GAUNTLET_PRIME_USDT_STRAT,
        [usdt],
        [1_62_804 * 10**6],
        std
      )
    )

    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_GAUNTLET_PRIME_USDC_STRAT,
        [usdc],
        [110_769 * 10**6],
        std
      )
    )

    profit = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(
      vault_value_checker.checkDelta(
        profit,
        (1 * 10**18),
        vault_change,
        (1 * 10**18),
        std
      )
    )

    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OETH supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

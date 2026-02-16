# -------------------------------------------------------------
# Feb 16, 2026 - Allocate 100 USDC to the Crosschain strategy
# -------------------------------------------------------------
from world import *
def main():
  with TemporaryForkForReallocations() as txs:
    txs.append(vault_core.rebase({'from': MULTICHAIN_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from': MULTICHAIN_STRATEGIST}))

    txs.append(vault_admin.depositToStrategy(
      CROSSCHAIN_MORPHO_V2_BASE_MASTER_STRATEGY,
      [usdc],
      [100 * 10**6],
      {'from': MULTICHAIN_STRATEGIST}
    ))
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), {'from': MULTICHAIN_STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("USDC supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")
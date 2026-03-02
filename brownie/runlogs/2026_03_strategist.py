# -------------------------------------------------------------
# Mar 2, 2026 - Reallocate from Curve AMO Strategy to Compounding Staking Strategy
# -------------------------------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Withdraw from Curve AMO Strategy
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_CURVE_AMO_STRAT, 
        [WETH], 
        [(15 + 32) * 10**18],
        {'from': STRATEGIST}
      )
    )

    # Deposit WETH to Compounding Staking Strategy
    txs.append(
      vault_oeth_admin.depositToStrategy(
        COMPOUNDING_STAKING_SSV_STRAT, 
        [WETH],
        [32 * 10**18],
        std
      )
    )

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(oeth_vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OETH supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")
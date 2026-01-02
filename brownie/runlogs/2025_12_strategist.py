# -------------------------------------
# December 26, 2025 - Reallocate 10k to the new Morpho OUSD v2 strategy
# -------------------------------------

from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_core.rebase(std))
    txs.append(vault_value_checker.takeSnapshot(std))

    # Withdraw 10k USDC from olg Gauntlet Prime Strategy
    txs.append(
      vault_admin.withdrawFromStrategy(
        MORPHO_GAUNTLET_PRIME_USDC_STRAT,
        [USDC],
        [10000 * 10**6],  # 10,000 USDC
        {'from': STRATEGIST}
      )
    )

    # Deposit 10k USDC to new Morpho OUSD v2 Strategy
    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_OUSD_V2_STRAT,
        [USDC],
        [10000 * 10**6],
        std
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OUSD supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

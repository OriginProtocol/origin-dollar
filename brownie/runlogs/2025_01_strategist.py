# -------------------------------------
# Jan 6, 2025 - Withdraw 1k from new OUSD Morpho Gauntlet Strategies
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_core.rebase(std))
    txs.append(vault_value_checker.takeSnapshot(std))

    # Remove 1k USDC from Morpho Gauntlet Strategy
    txs.append(
      vault_admin.withdrawFromStrategy(
        MORPHO_GAUNTLET_PRIME_USDC_STRAT, 
        [usdc], 
        [1000 * 10**6],
        {'from': STRATEGIST}
      )
    )

    # Remove 1k USDT from Morpho Gauntlet Strategy
    txs.append(
      vault_admin.withdrawFromStrategy(
        MORPHO_GAUNTLET_PRIME_USDT_STRAT, 
        [usdt], 
        [1000 * 10**6],
        {'from': STRATEGIST}
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

# -------------------------------------
# Jan 7, 2025 - Withdraw 100k USDC from Morpho Steakhouse and deposit in Morpho Gauntlet Prime
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_core.rebase(std))
    txs.append(vault_value_checker.takeSnapshot(std))

    # Remove 100k USDC from Morpho Steakhouse Strategy
    txs.append(
      vault_admin.withdrawFromStrategy(
        MORPHO_META_USDC_STRAT, 
        [usdc], 
        [1000000 * 10**6],
        {'from': STRATEGIST}
      )
    )

    # Deposit 100k USDC tin Morpho Gauntlet Prime Strategy
    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_GAUNTLET_PRIME_USDC_STRAT, 
        [usdc],
        [1000000 * 10**6],
        {'from': STRATEGIST}
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



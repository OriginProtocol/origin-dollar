# -------------------------------------
# January 5, 2026 - Reallocate remaining USDC in Gauntlet Prime Strategy to Morpho OUSD v2 Strategy
# -------------------------------------

from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_core.rebase(std))
    txs.append(vault_value_checker.takeSnapshot(std))

    # Withdraw all USDC from old Gauntlet Prime Strategy
    txs.append(
      vault_admin.withdrawAllFromStrategy(
        MORPHO_GAUNTLET_PRIME_USDC_STRAT,
        {'from': STRATEGIST}
      )
    )

    # Deposit 3m USDC to new Morpho OUSD v2 Strategy
    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_OUSD_V2_STRAT,
        [USDC],
        [3000000 * 10**6],
        std
      )
    )

    # Set Morpho OUSD v2 Strategy as default for USDC
    txs.append(
      vault_admin.setAssetDefaultStrategy(
        USDC,
        MORPHO_OUSD_V2_STRAT,
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

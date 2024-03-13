# -------------------------------
# Mar 13, 2024 - OUSD Allocation
# -------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({'from':STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from':STRATEGIST}))

    # Withdraw all USDC and USDT from Flux 
    txs.append(
      vault_admin.withdrawFromStrategy(
        FLUX_STRAT, 
        [usdt, usdc], 
        [flux_strat.checkBalance(usdt), flux_strat.checkBalance(usdc)], 
        {'from': STRATEGIST}
      )
    )

    # Put everything in Morpho Aave (default strategy for USDC and USDT)
    txs.append(vault_core.allocate({'from': STRATEGIST}))

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (500 * 10**18), vault_change, (500 * 10**18), {'from': STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
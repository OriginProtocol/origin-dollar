
# -------------------------------------
# August 11, 2025 - Claim validator withdrawal and deposit SwapX AMO on Sonic
# -------------------------------------
from world_sonic import *

def main():
  with TemporaryForkForReallocations() as txs:

    amount = 330420 * 10**18

    # Before
    txs.append(vault_core.rebase({'from': SONIC_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from': SONIC_STRATEGIST}))

    txs.append(
      sonic_staking_strat.withdrawFromSFC(
        53,
        {'from': SONIC_STRATEGIST}
      )
    )

    # Claim withdrawal from the Validator
    txs.append(
      vault_admin.depositToStrategy(
        SWAPX_AMO_STRATEGY, 
        [WS_SONIC],
        [amount],
        {'from': SONIC_STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(SONIC_STRATEGIST)[0]
    supply_change = os.totalSupply() - vault_value_checker.snapshots(SONIC_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (10 * 10**18), vault_change, (100 * 10**18), {'from': SONIC_STRATEGIST}))

    print("-----")
    print("Profit in wS", "{:.6f}".format(profit / 10**18), profit)
    print("OS supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("OS Vault change ", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")


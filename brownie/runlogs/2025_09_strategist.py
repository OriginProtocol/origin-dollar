
# -------------------------------------
# September 23, 2025 - Rebalance SwapX AMO pool by burning OS.
# wS and OS is removed from the pool,
# the received wS is swapped for OS and the left over OS in the strategy is burnt.
# -------------------------------------
from world_sonic import *

def main():
  with TemporaryForkForReallocations() as txs:

    # Before
    txs.append(vault_core.rebase({'from': SONIC_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from': SONIC_STRATEGIST}))

    ws_swap_in_amount = 80000 * 10**18
    print("Amount wS to swap into the pool  ", "{:.2f}".format(ws_swap_in_amount / 10**18))

    # AMO pool before
    print_amo_pool_status("Before")

    # Claim withdrawal from the Validator
    txs.append(
      swapx_amo_strat.swapAssetsToPool(
        ws_swap_in_amount,
        {'from': SONIC_STRATEGIST}
      )
    )
    # AMO pool after
    print_amo_pool_status("After")

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(SONIC_STRATEGIST)[0]
    supply_change = os.totalSupply() - vault_value_checker.snapshots(SONIC_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (10 * 10**18), vault_change, (100 * 10**18), {'from': SONIC_STRATEGIST}))

    print("-----")
    print("Profit in wS", "{:.2f}".format(profit / 10**18), profit)
    print("OS supply change", "{:.2f}".format(supply_change / 10**18), supply_change)
    print("OS Vault change ", "{:.2f}".format(vault_change / 10**18), vault_change)
    print("-----")

# -------------------------------------
# September 24, 2025 - Rebalance SwapX AMO pool by burning OS.
# wS and OS is removed from the pool,
# the received wS is swapped for OS and the left over OS in the strategy is burnt.
# -------------------------------------
from world_sonic import *

def main():
  with TemporaryForkForReallocations() as txs:

    # Before
    txs.append(vault_core.rebase({'from': SONIC_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from': SONIC_STRATEGIST}))
 
    ws_swap_in_amount = 100000 * 10**18
    print("Amount wS to swap into the pool  ", "{:.2f}".format(ws_swap_in_amount / 10**18))

    # AMO pool before
    print_amo_pool_status("Before")

    # Claim withdrawal from the Validator
    txs.append(
      swapx_amo_strat.swapAssetsToPool(
        ws_swap_in_amount,
        {'from': SONIC_STRATEGIST}
      )
    )

    # AMO pool after
    print_amo_pool_status("After")

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(SONIC_STRATEGIST)[0]
    supply_change = os.totalSupply() - vault_value_checker.snapshots(SONIC_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (10 * 10**18), vault_change, (100 * 10**18), {'from': SONIC_STRATEGIST}))

    print("-----")
    print("Profit in wS", "{:.2f}".format(profit / 10**18), profit)
    print("OS supply change", "{:.2f}".format(supply_change / 10**18), supply_change)
    print("OS Vault change ", "{:.2f}".format(vault_change / 10**18), vault_change)
    print("-----")

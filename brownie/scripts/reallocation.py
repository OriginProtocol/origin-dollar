# -------------------------------
# July 13, 2023 - OUSD Allocation
# -------------------------------
from world import *
from allocations import *

txs = []

votes = """
Morpho Aave USDT  79.46%
Convex OUSD+3Crv  9.93%
Morpho Compound DAI 7.06%
Morpho Compound USDC 2.99%
Morpho Compound USDT 0.57%
Morpho Aave DAI 0%
Morpho Aave USDC  0%
Convex DAI+USDC+USDT  0%
Aave DAI  0%
Convex LUSD+3Crv  0%
Existing Allocation 0%
Aave USDC 0%
Aave USDT 0%
Compound DAI  0%
Compound USDC 0%
Compound USDT 0%
"""

def main():
  with TemporaryForkWithVaultStats(votes=votes):
    # Before
    txs.append(vault_core.rebase({'from': STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from': STRATEGIST}))

    # Withdraw all from Aave
    txs.append(
      vault_admin.withdrawAllFromStrategy(AAVE_STRAT, {'from': STRATEGIST})
    )

    # Deposit 610k USDC and 116k USDT to Morpho Compound
    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_COMP_STRAT,
        [usdc, usdt],
        [610430.4 * 10**6, 116194.6 * 10**6],
        {'from': STRATEGIST}
      )
    )

    # Withdraw all from Morpho Aave
    txs.append(
      vault_admin.withdrawAllFromStrategy(MORPHO_AAVE_STRAT, {'from': STRATEGIST})
    )

    # Deposit 3.61M USDT and USDC to Curve AMO
    txs.append(
      vault_admin.depositToStrategy(
        OUSD_METASTRAT,
        [usdc, usdt],
        [1335700 * 10**6, 2274300 * 10**6],
        {'from': STRATEGIST}
      )
    )

    net_held_by_amo = ousd_meta_strat.checkBalance(usdt) + ousd_meta_strat.checkBalance(usdc) + (ousd_meta_strat.checkBalance(dai) / 10**12)
    # Withdraw 80% in USDT and rest in DAI from Curve AMO
    txs.append(
      vault_admin.withdrawFromStrategy(
        OUSD_METASTRAT,
        [usdt, dai],
        [net_held_by_amo * 0.8 / 10**12, net_held_by_amo * 0.2],
        {'from': STRATEGIST}
      )
    )

    # Deposit all DAI to Morpho Compound
    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_COMP_STRAT,
        [dai],
        [dai.balanceOf(VAULT_PROXY_ADDRESS)],
        {'from': STRATEGIST}
      )
    )

    # Deposit all USDT to Morpho Aave
    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_AAVE_STRAT,
        [usdt],
        [usdt.balanceOf(VAULT_PROXY_ADDRESS)],
        {'from': STRATEGIST}
      )
    )

    # Finish it off with a rebase
    txs.append(vault_core.rebase({'from': STRATEGIST}))

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (500 * 10**18), vault_change, (500 * 10**18), {'from': STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

    print("Schedule the following transactions on Gnosis Safe")
    for idx, item in enumerate(txs):
      print("Transaction ", idx)
      print("To: ", item.receiver)
      print("Data (Hex encoded): ", item.input, "\n")

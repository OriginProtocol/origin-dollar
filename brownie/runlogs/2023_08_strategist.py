# -------------------------------------
# Aug 1, 2023 - OETH back into earning
# ------------------------------------

from world import *


with TemporaryForkForReallocations() as txs:
  # Before
  txs.append(vault_oeth_core.rebase({'from':STRATEGIST}))
  txs.append(oeth_vault_value_checker.takeSnapshot({'from':STRATEGIST}))

  # Strategist
  txs.append(vault_oeth_admin.withdrawAllFromStrategy(OETH_CONVEX_OETH_ETH_STRAT, {'from': STRATEGIST}))
  txs.append(vault_oeth_admin.depositToStrategy(OETH_CONVEX_OETH_ETH_STRAT, [weth], [4_853*1e18], {'from': STRATEGIST}))

  #After
  vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
  supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
  profit = vault_change - supply_change
  txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (1000 * 10**18), {'from': STRATEGIST}))
  print("-----")
  print("Profit", "{:.6f}".format(profit / 10**18), profit)
  print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
  print("-----")

  
# -------------------------------------
# Aug 2, 2023 - OETH back into earning
# ------------------------------------

from world import *

with TemporaryForkForReallocations() as txs:
  # Before
  txs.append(vault_oeth_core.rebase({'from':STRATEGIST}))
  txs.append(oeth_vault_value_checker.takeSnapshot({'from':STRATEGIST}))

  # Strategist
  txs.append(vault_oeth_admin.depositToStrategy(OETH_CONVEX_OETH_ETH_STRAT, [weth], [1_952*1e18], {'from': STRATEGIST}))

  #After
  vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
  supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
  profit = vault_change - supply_change
  txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (1000 * 10**18), {'from': STRATEGIST}))
  print("-----")
  print("Profit", "{:.6f}".format(profit / 10**18), profit)
  print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
  print("-----")

  
# -------------------------------------
# Aug 2, 2023 - Remaining OETH back into earning
# ------------------------------------

from world import *

with TemporaryForkForReallocations() as txs:
  # Before
  txs.append(vault_oeth_core.rebase({'from':STRATEGIST}))
  txs.append(oeth_vault_value_checker.takeSnapshot({'from':STRATEGIST}))

  # Strategist
  vault_weth = weth.balanceOf(vault_oeth_admin)
  txs.append(vault_oeth_admin.depositToStrategy(OETH_CONVEX_OETH_ETH_STRAT, [weth], [vault_weth-int(100*1e18)], {'from': STRATEGIST}))

  #After
  vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
  supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
  profit = vault_change - supply_change
  txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (1000 * 10**18), {'from': STRATEGIST}))
  print("-----")
  print("Profit", "{:.6f}".format(profit / 10**18), profit)
  print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
  print("-----")

  
# -----------------------------------
# August 03, 2023 - OGV Buyback
# -----------------------------------
from buyback import *

def main():
  build_buyback_tx(max_dollars=2250, max_slippage=1.5, with_fork=True)

  
# -----------------------------------
# August 03, 2023 - CVX Buyback
# -----------------------------------
from world import *
from oneinch import get_1inch_swap_data

txs = []
def main():
  with TemporaryFork():
    slippage = 1

    oeth_balance = oeth.balanceOf(STRATEGIST)
    ousd_balance = ousd.balanceOf(STRATEGIST)

    # Approve 1-inch to move OETH and OUSD
    txs.append(
      oeth.approve(ROUTER_1INCH_V5, oeth_balance, {'from': STRATEGIST})
    )
    txs.append(
      ousd.approve(ROUTER_1INCH_V5, ousd_balance, {'from': STRATEGIST})
    )

    # Swap OETH for CVX
    txs.append(
      get_1inch_swap_data(
        OETH,
        CVX,
        oeth_balance,
        slippage,
      )
    )

    # Swap OUSD for CVX
    txs.append(
      get_1inch_swap_data(
        OUSD,
        CVX,
        ousd_balance,
        slippage,
      )
    )

    print("Schedule the following transactions on Gnosis Safe")
    for idx, item in enumerate(txs):
      print("Transaction ", idx)
      print("To: ", item.receiver)
      print("Data (Hex encoded): ", item.input, "\n")


# -----------------------------------
# August 03, 2023 - OGV Buyback 2
# -----------------------------------
from buyback import *

txs = []
def main():
  build_buyback_tx(max_slippage=1.5, with_fork=True)

# -------------------------------
# Aug 07, 2023 - OUSD Allocation
# -------------------------------
from world import *
from allocations import *

txs = []

votes = """
Morpho Aave DAI 14.65%
Morpho Aave USDC  14.65%
Morpho Aave USDT  43.95%
Morpho Compound DAI 2.12%
Morpho Compound USDC 2.12%
Morpho Compound USDT 22.51%
Convex DAI+USDC+USDT  0%
Convex OUSD+3Crv  0%
Aave DAI  0%
Convex LUSD+3Crv  0%
Existing Allocation 0%
Aave USDC 0%
Aave USDT 0%
Compound DAI  0%
Compound USDC 0%
Compound USDT 0%
"""

with TemporaryForkWithVaultStats(votes=votes):
  # Before
  txs.append(vault_core.rebase({'from': STRATEGIST}))
  txs.append(vault_value_checker.takeSnapshot({'from': STRATEGIST}))

  # Deposit 1.9M DAI, 1.7M USDC and 9.7M USDT to Morpho Aave
  txs.append(
    to_strat(
      MORPHO_AAVE_STRAT,
      [
        [1_994_838, dai],
        [1_725_562, usdc],
        [9_760_841, usdt],
      ]
    )
  )

  # Deposit rest to Morpho Compound
  txs.append(
    to_strat(
      MORPHO_COMP_STRAT,
      [
        [288_680, dai],
        [249_713, usdc],
        [4_999_704, usdt],
      ]
    )
  )

  # Finish it off with a rebase
  txs.append(vault_core.rebase({'from': STRATEGIST}))

  # Set default strategies
  txs.append(vault_admin.setAssetDefaultStrategy(usdt, MORPHO_AAVE_STRAT,{'from' :STRATEGIST}))
  txs.append(vault_admin.setAssetDefaultStrategy(usdc, MORPHO_AAVE_STRAT,{'from' :STRATEGIST}))
  txs.append(vault_admin.setAssetDefaultStrategy(dai, MORPHO_AAVE_STRAT,{'from': STRATEGIST}))

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

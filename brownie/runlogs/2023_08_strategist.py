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

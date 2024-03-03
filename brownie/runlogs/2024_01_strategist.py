# -------------------------------------
# Jan 03, 2024 - OETH Buyback
# -------------------------------------
from buyback import *

def main():
  txs = []

  with TemporaryFork():
    txs.append(
      build_buyback_tx(
        OETH,
        oeth.balanceOf(OETH_BUYBACK),
        max_ogv_slippage=1.25,
        max_cvx_slippage=2.5
      )
    )

    print(to_gnosis_json(txs))

# -------------------------------------
# Jan 03, 2024 - CVX relock
# -------------------------------------
from buyback import *

def main():
  txs = []

  with TemporaryFork():
    txs.append(
      cvx_locker.processExpiredLocks(True, std)
    )

    print(to_gnosis_json(txs))


# -------------------------------------
# Jan 03, 2024 - OUSD Buyback
# -------------------------------------
from buyback import *

def main():
  txs = []

  with TemporaryFork():
    txs.append(
      build_buyback_tx(
        OUSD,
        ousd.balanceOf(OUSD_BUYBACK),
        max_ogv_slippage=1.25,
        max_cvx_slippage=3
      )
    )

    print(to_gnosis_json(txs))

# -------------------------------------
# Jan 03, 2024 - OETH Reallocation
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # withdraw 3,500 ETH from the AMO
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [WETH], 
        [3500 * 10**18],
        std
      )
    )

    # deposit 3,800 ETH into Morpho Aave
    txs.append(
      oeth_vault_admin.depositToStrategy(
        OETH_MORPHO_AAVE_STRAT, 
        [WETH], 
        [3800 * 10**18], 
        std
      )
    )

    # deposit 200 rETH into Aura
    txs.append(
      vault_oeth_admin.depositToStrategy(
        BALANCER_RETH_STRATEGY, 
        [reth], 
        [200 * 10**18], 
        std
      )
    )

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(oeth_vault_value_checker.checkDelta(profit, (0.25 * 10**18), vault_change, (0.25 * 10**18), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OETH supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

# -------------------------------------
# Jan 19, 2024 - OETH allocation
# -------------------------------------

from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # deposit 2,672.14 ETH to the AMO
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [WETH], 
        [2_672.14 * 10**18],
        std
      )
    )

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(oeth_vault_value_checker.checkDelta(profit, (0.25 * 10**18), vault_change, (0.25 * 10**18), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OETH supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")


# -------------------------------------
# Jan 29, 2024 - OETH Reallocation
# -------------------------------------
from world import *

with TemporaryForkForReallocations() as txs:
  # Before
  txs.append(vault_oeth_core.rebase(std))
  txs.append(oeth_vault_value_checker.takeSnapshot(std))

  # withdraw 3,500 ETH from the AMO
  txs.append(
    vault_oeth_admin.withdrawFromStrategy(
      OETH_MORPHO_AAVE_STRAT, 
      [WETH], 
      [2957.922 * 10**18],
      std
    )
  )

  # deposit 3,800 ETH into Morpho Aave
  txs.append(
    oeth_vault_admin.depositToStrategy(
      OETH_CONVEX_OETH_ETH_STRAT, 
      [WETH], 
      [2957.922 * 10**18], 
      std
    )
  )

  # After
  vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
  supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
  profit = vault_change - supply_change
  txs.append(oeth_vault_value_checker.checkDelta(profit, (0.25 * 10**18), vault_change, (0.25 * 10**18), std))
  print("-----")
  print("Profit", "{:.6f}".format(profit / 10**18), profit)
  print("OETH supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
  print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
  print("-----")


# -------------------------------------
# Jan 29, 2024 - OETH Burn OETH
# -------------------------------------
from world import *

with TemporaryForkForReallocations() as txs:
  # Before
  txs.append(vault_oeth_core.rebase(std))
  txs.append(oeth_vault_value_checker.takeSnapshot(std))

  metapool_virtual_price = 1001209756036959115

  # burn 2957.922 OETH from the LP position
  txs.append(
    oeth_meta_strat.removeAndBurnOTokens(
      2957.922 * 10**18 * 10**18 / metapool_virtual_price, 
      std
    )
  )

  # After
  vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
  supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
  profit = vault_change - supply_change
  txs.append(oeth_vault_value_checker.checkDelta(profit, (0.25 * 10**18), vault_change, (0.25 * 10**18), std))
  print("-----")
  print("Profit", "{:.6f}".format(profit / 10**18), profit)
  print("OETH supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
  print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
  print("-----")

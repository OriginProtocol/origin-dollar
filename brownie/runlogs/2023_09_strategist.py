# -------------------------------------
# Sep 13, 2023 - OGV Buyback
# ------------------------------------
from buyback import *

def main():
  build_buyback_tx(max_dollars=14000, max_slippage=9)

# -------------------------------------
# Sep 13, 2023 - Buy CVX
# ------------------------------------
from convex import *

def main():
  build_cvx_buyback_tx(slippage=1)
  
# -------------------------------------
# Sep 13, 2023 - Buy CVX
# ------------------------------------
from convex import *

def main():
  lock_cvx()

# -------------------------------------
# Sep 26, 2023 - OETH Reallocation
# ------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase({'from': STRATEGIST}))
    txs.append(oeth_vault_value_checker.takeSnapshot({'from': STRATEGIST}))

    # Remove 1.4k WETH from strategy and burn equivalent OETH
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [weth], 
        [1_403 * 10**18],
        {'from': STRATEGIST}
      )
    )
    
    # Deposit 1.65k WETH to FraxETHStrategy
    txs.append(
      vault_oeth_admin.depositToStrategy(
        FRAX_ETH_STRATEGY, 
        [weth], 
        [1_654.18*10**18], 
        {'from': STRATEGIST}
      )
    )

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (0.1 * 10**18), {'from': STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

# -------------------------------------
# Sep 27, 2023 - OGV Buyback
# ------------------------------------
from buyback import *

def main():
  build_buyback_tx(max_dollars=10000, max_slippage=1)

# -------------------------------------
# Sep 27, 2023 - Buy CVX
# ------------------------------------
from convex import *

def main():
  build_cvx_buyback_tx(slippage=1)

# -------------------------------------
# Sep 27, 2023 - Lock CVX
# ------------------------------------
from convex import *

def main():
  lock_cvx()
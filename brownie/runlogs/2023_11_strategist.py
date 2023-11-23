# -------------------------------------
# Nov 09, 2023 - OETH Buyback
# -------------------------------------
from buyback import *

def main():
  txs = []

  with TemporaryFork():
    # Transfer all OETH from Strategist to the buyback contract
    txs.append(
      oeth.transfer(OETH_BUYBACK, oeth.balanceOf(STRATEGIST), std)
    )

    txs.append(
      build_buyback_tx(
        OETH,
        oeth.balanceOf(OETH_BUYBACK),
        max_ogv_slippage=3,
        max_cvx_slippage=3.5
      )
    )

    print(to_gnosis_json(txs))

# -------------------------------------
# Nov 09, 2023 - OUSD Buyback
# -------------------------------------
from buyback import *

def main():
  txs = []

  with TemporaryFork():
    txs.append(
      build_buyback_tx(
        OUSD,
        ousd.balanceOf(OUSD_BUYBACK),
        max_ogv_slippage=3,
        max_cvx_slippage=3.5
      )
    )

    print(to_gnosis_json(txs))

# -------------------------------------
# Nov 17, 2023 - OUSD Reallocation
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    txs.append(vault_core.rebase({'from':STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from':STRATEGIST}))

    txs.append(
      vault_admin.withdrawFromStrategy(
        MORPHO_COMP_STRAT, 
        [USDC], 
        [morpho_comp_strat.checkBalance(USDC)], 
        {'from': STRATEGIST}
      )
    )

    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_AAVE_STRAT, 
        [USDC], 
        [usdc.balanceOf(VAULT_PROXY_ADDRESS)], 
        {'from': STRATEGIST}
      )
    )

    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (500 * 10**18), vault_change, (500 * 10**18), {'from': STRATEGIST}))

    txs.append(vault_core.allocate({'from': STRATEGIST}))

# -------------------------------------
# Nov 20, 2023 - OETH AMO Burn
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Remove 6522 LP Tokens (~6537 OETH)
    txs.append(oeth_meta_strat.removeAndBurnOTokens(6522 * 1e18, std))

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (0.1 * 10**18), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

# -------------------------------------
# Nov 22, 2023 - OETH swap and allocation
# -------------------------------------
from world import *
from collateralSwap import *

# two thirds of the Vault's holding
two_thirds_steth = 3100603269179117666304 # 3100 stETH

def main():
  txs = []
  with TemporaryFork():
    txs.append(oeth_vault_value_checker.takeSnapshot({'from':STRATEGIST}))

    txs.append(
      build_swap_tx(
        STETH,
        WETH,
        two_thirds_steth,
        0.3,
        False,
        dry_run=False
      )
    )

    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [weth], 
        [two_thirds_steth],
        {'from': STRATEGIST}
      )
    )

    #txs.append(vault_value_checker.checkDelta(0, (1 * 10**18), 0, (1 * 10**18), {'from': STRATEGIST}))
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(oeth_vault_value_checker.checkDelta(profit, (0.5 * 10**18), vault_change, (1.5 * 10**18), {'from': STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

  print(to_gnosis_json(txs))

# -------------------------------------
# Nov 22, 2023 - OETH & OUSD Buyback
# -------------------------------------
from buyback import *

def main():
  txs = []

  with TemporaryFork():
    txs.append(
      build_buyback_tx(
        OETH,
        oeth.balanceOf(OETH_BUYBACK),
        max_ogv_slippage=1,
        max_cvx_slippage=1
      )
    )

    txs.append(
      build_buyback_tx(
        OUSD,
        ousd.balanceOf(OUSD_BUYBACK),
        max_ogv_slippage=1,
        max_cvx_slippage=1
      )
    )

    print(to_gnosis_json(txs))

# -------------------------------------
# Nov 22, 2023 - Withdraw from Morpho
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    txs.append(
      oeth_vault_admin.withdrawFromStrategy(
        OETH_MORPHO_AAVE_STRAT, 
        [WETH], 
        [60 * 10**18], 
        std
      )
    )

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (0.1 * 10**18), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

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
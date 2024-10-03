# -----------------------------------------------------
# Oct 3rd 2024 - OETHb allocation & rebalance
# -----------------------------------------------------

from world_base import *

def main():
  with TemporaryForkForOETHbReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({ 'from': OETHB_STRATEGIST }))
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_STRATEGIST }))

    # Deposit all WETH
    wethDepositAmount = weth.balanceOf(OETHB_VAULT_PROXY_ADDRESS)
    txs.append(
      vault_admin.depositToStrategy(
        OETHB_AERODROME_AMO_STRATEGY, 
        [weth], 
        [wethDepositAmount], 
        {'from': OETHB_STRATEGIST}
      )
    )

    amo_snapsnot()
    swapWeth = True
    swapAmount = 1e18
    minAmount = swapAmount * 0.98
    print("--------------------")
    print("WETH Deposit ", c18(wethDepositAmount))
    print("-----")
    print("Swap amount  ", c18(swapAmount))
    print("Min  amount  ", c18(minAmount))
    print("-----")

    txs.append(
      amo_strat.rebalance(
        swapAmount,
        swapWeth,
        minAmount,
        {'from': OETHB_STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), {'from': OETHB_STRATEGIST}))

    amo_snapsnot()
    print("--------------------")
    print("Profit       ", c18(profit), profit)
    print("Vault Change ", c18(vault_change), vault_change)

# -----------------------------------------------------
# Oct 3rd 2024 - OUSD Reallocation 200k USDC from Morpho Aave to new MetaMorpho
# -----------------------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({'from':STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from':STRATEGIST}))

    # Withdraw 10k from Morpho Aave
    txs.append(
      vault_admin.withdrawFromStrategy(
        MORPHO_AAVE_STRAT, 
        [usdc], 
        [200_000 * 10**6], 
        {'from': STRATEGIST}
      )
    )

    # Put everything in new MetaMorpho
    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_META_USDC_STRAT, 
        [usdc], 
        [200_000*10**6], 
        {'from': STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (500 * 10**18), vault_change, (500 * 10**18), {'from': STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
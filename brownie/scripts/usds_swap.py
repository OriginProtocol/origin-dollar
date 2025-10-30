
from collateralSwap import *

def main():
  with TemporaryForkForReallocations() as txs:
    txs.append(vault_core.rebase({'from':MULTICHAIN_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from':MULTICHAIN_STRATEGIST}))

    txs.append(
      vault_admin.withdrawAllFromStrategy(
        MAKER_SSR_STRAT, 
        {'from': MULTICHAIN_STRATEGIST}
      )
    )

    usds_balance = usds.balanceOf(VAULT_PROXY_ADDRESS)

    print("USDS balance: ", usds_balance)

    txs.append(
      build_swap_tx(
        USDS,
        USDC,
        usds_balance,
        0.5,
        False,
        False
      )
    )

    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (500 * 10**18), vault_change, (500 * 10**18), {'from': MULTICHAIN_STRATEGIST}))

  print("Schedule the following transactions on Gnosis Safe")
  for idx, item in enumerate(txs):
    print("Transaction ", idx)
    print("To: ", item.receiver)
    print("Data (Hex encoded): ", item.input, "\n")
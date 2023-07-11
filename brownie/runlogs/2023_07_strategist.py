# --------------------------------
# July 4, 2023 - OETH AMO Deposit
# --------------------------------

from world import *

txs = []
with TemporaryFork():
  # Before
  txs.append(vault_oeth_core.rebase({'from':STRATEGIST}))
  txs.append(oeth_vault_value_checker.takeSnapshot({'from':STRATEGIST}))

  # Strategist
  txs.append(vault_oeth_admin.depositToStrategy(OETH_CONVEX_OETH_ETH_STRAT, [weth], [1000*1e18], {'from': STRATEGIST}))

  #After
  vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
  supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
  profit = vault_change - supply_change
  txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (10 * 10**18), {'from': STRATEGIST}))
  print("-----")
  print("Profit", "{:.6f}".format(profit / 10**18), profit)
  print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
  print("-----")
  print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))

  print("Schedule the following transactions on Gnosis Safe")
  for idx, item in enumerate(txs):
    print("Transaction ", idx)
    print("To: ", item.receiver)
    print("Data (Hex encoded): ", item.input, "\n")

# -------------------------------------------
# July 5, 2023 - OUSD Curve Pool Rebalancing
# -------------------------------------------
from world import *

txs = []

def main():
  with TemporaryFork():
    # Before
    txs.append(vault_core.rebase({'from':STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from':STRATEGIST}))

    # Withdraw 19.2M USDT from Morpho Aave
    txs.append(vault_admin.withdrawFromStrategy(MORPHO_AAVE_STRAT, [usdt], [19218884.27*10**6], {'from': STRATEGIST}))
    # Deposit it to MetaStrategy
    txs.append(vault_admin.depositToStrategy(OUSD_METASTRAT, [usdt], [19218884.27*10**6], {'from': STRATEGIST}))
    # Withdraw 17.8M USDT from Curve AMO
    txs.append(vault_admin.withdrawFromStrategy(OUSD_METASTRAT, [usdt], [17884615.2*10**6], {'from': STRATEGIST}))
    # Deposit it to MetaStrategy
    txs.append(vault_admin.depositToStrategy(MORPHO_AAVE_STRAT, [usdt], [17884615.2*10**6], {'from': STRATEGIST}))

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

# -----------------------------------
# July 6, 2023 - Collateral Swap Test
# -----------------------------------
from collateralSwap import *

txs = []

def main():
  with TemporaryFork():
    # Before
    txs.append(oeth_vault_core.rebase({'from':STRATEGIST}))
    txs.append(oeth_vault_value_checker.takeSnapshot({'from':STRATEGIST}))

    # Swap 50 stETH for frxETH with 0.1% tolerance
    _, swap_data = build_swap_tx(STETH, FRXETH, 50 * 10**18, 0.1, False)
    decoded_input = vault_core_w_swap_collateral.swapCollateral.decode_input(swap_data)
    txs.append(
      vault_core_w_swap_collateral.swapCollateral(*decoded_input, {'from':STRATEGIST})
    )
    txs.append(
      oeth_vault_core.allocate({'from':STRATEGIST})
    )

    # After
    vault_change = oeth_vault_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (0.1 * 10**18), {'from': STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

    print("Schedule the following transactions on Gnosis Safe")
    for idx, item in enumerate(txs):
      print("Transaction ", idx)
      print("To: ", item.receiver)
      print("Data (Hex encoded): ", item.input, "\n")


# -----------------------------------
# July 11, 2023 - rETH Collateral Swap Test
# -----------------------------------
from collateralSwap import *

txs = []

def main():
  with TemporaryFork():
    # Before
    txs.append(oeth_vault_core.rebase({'from':STRATEGIST}))
    txs.append(oeth_vault_value_checker.takeSnapshot({'from':STRATEGIST}))

    # Swap 900 rETH for WETH with 0.1% tolerance
    _, swap_data = build_swap_tx(RETH, WETH, 900 * 10**18, 0.1, False)
    decoded_input = vault_core_w_swap_collateral.swapCollateral.decode_input(swap_data)
    txs.append(
      vault_core_w_swap_collateral.swapCollateral(*decoded_input, {'from':STRATEGIST})
    )

    # ~968 WETH from swap
    # 1,946 WETH in the vault
    # Deposit 2900 WETH to Convex OETH-ETH strategy
    txs.append(vault_oeth_admin.depositToStrategy(OETH_CONVEX_OETH_ETH_STRAT, [WETH], [2900*1e18], {'from': STRATEGIST}))

    # After
    vault_change = oeth_vault_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (0.1 * 10**18), {'from': STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

    print("Schedule the following transactions on Gnosis Safe")
    for idx, item in enumerate(txs):
      print("Transaction ", idx)
      print("To: ", item.receiver)
      print("Data (Hex encoded): ", item.input, "\n")

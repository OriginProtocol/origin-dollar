# -------------------------------
# Mar 13, 2024 - OUSD Allocation
# -------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({'from':STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from':STRATEGIST}))

    # Withdraw all USDC and USDT from Flux 
    txs.append(
      vault_admin.withdrawFromStrategy(
        FLUX_STRAT, 
        [usdt, usdc], 
        [flux_strat.checkBalance(usdt), flux_strat.checkBalance(usdc)], 
        {'from': STRATEGIST}
      )
    )

    # Put everything in Morpho Aave (default strategy for USDC and USDT)
    txs.append(vault_core.allocate({'from': STRATEGIST}))

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (500 * 10**18), vault_change, (500 * 10**18), {'from': STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

# ---------------------------------
# Mar 14, 2024 - Move out from Flux
# ---------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({'from':STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from':STRATEGIST}))

    # Withdraw all from Flux (including dust)
    txs.append(
      vault_admin.withdrawAllFromStrategy(
        FLUX_STRAT,
        {'from': STRATEGIST}
      )
    )

    # Put everything in Morpho Aave (default strategy for USDC and USDT)
    txs.append(vault_core.allocate({'from': STRATEGIST}))

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (500 * 10**18), vault_change, (500 * 10**18), {'from': STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

# -------------------------------------
# Mar 15, 2024 - OETH Buyback
# -------------------------------------
from buyback import *

def main():
  txs = []

  with TemporaryFork():
    txs.append(
      build_buyback_tx(
        OETH,
        oeth.balanceOf(OETH_BUYBACK),
        max_ogv_slippage=3,
        max_cvx_slippage=10
      )
    )

    txs.append(
      cvx_locker.processExpiredLocks(True, std)
    )

    print(to_gnosis_json(txs))

# -------------------------------------
# Mar 15, 2024 - OETH Reallocation
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Deposit 467 rETH and 230 WERH to the Balancer strategy
    txs.append(
      vault_oeth_admin.depositToStrategy(
        BALANCER_RETH_STRATEGY, 
        [reth, WETH], 
        [467.04342 * 10**18, 230.56953 * 10**18],
        std
      )
    )

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(oeth_vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OETH supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

# -------------------------------------
# Mar 18, 2024 - OUSD Buyback
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
        max_cvx_slippage=6
      )
    )

    print(to_gnosis_json(txs))

# -----------------------------------
# Mar 22, 2024 - Swap out of stETH
# -----------------------------------
from collateralSwap import *

txs = []

def main():
  with TemporaryFork():
    # Before
    txs.append(oeth_vault_core.rebase({'from':STRATEGIST}))
    txs.append(oeth_vault_value_checker.takeSnapshot({'from':STRATEGIST}))

    # Swap 691 stETH for WETH with 0.1% tolerance
    _, swap_data = build_swap_tx(STETH, WETH, 691.0238 * 10**18, 0.1, False)
    decoded_input = oeth_vault_core.swapCollateral.decode_input(swap_data)
    txs.append(
      oeth_vault_core.swapCollateral(*decoded_input, {'from':STRATEGIST})
    )

    # Deposit it to Morpho Aave
    txs.append(vault_oeth_admin.depositToStrategy(OETH_MORPHO_AAVE_STRAT, [WETH], [691.0238 * 10**18], {'from': STRATEGIST}))

    # After
    vault_change = oeth_vault_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (0.1 * 10**18), {'from': STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

    print("Schedule the following transactions on Gnosis Safe")
    print(to_gnosis_json(txs))

# -----------------------------------
# Mar 23, 2024 - Swap some rETH
# -----------------------------------
from collateralSwap import *

txs = []

def main():
  with TemporaryFork():
    # Before
    txs.append(oeth_vault_core.rebase({'from':STRATEGIST}))
    txs.append(oeth_vault_value_checker.takeSnapshot({'from':STRATEGIST}))

    # Withdraw WETH & rETH from Balancer AMO
    txs.append(
      oeth_vault_admin.withdrawFromStrategy(
        BALANCER_RETH_STRATEGY, 
        [weth, reth], 
        [966.034 * 10**18, 920.591 * 10**18], 
        std
      )
    )
    # Swap 920.591 RETH for WETH with 0.1% tolerance
    _, swap_data = build_swap_tx(RETH, WETH, 920.591 * 10**18, 0.1, False)
    decoded_input = oeth_vault_core.swapCollateral.decode_input(swap_data)
    txs.append(
      oeth_vault_core.swapCollateral(*decoded_input, {'from':STRATEGIST})
    )

    # Deposit to Morpho Aave
    txs.append(
      oeth_vault_admin.depositToStrategy(
        OETH_MORPHO_AAVE_STRAT, 
        [weth], 
        [1980.2655 * 10**18], 
        std
      )
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
    print(to_gnosis_json(txs))

# -------------------------------------
# Mar 26, 2024 - frxETH Test Redemption
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Withdraw frxETH from FrxETHStrategy
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_FRAX_ETH_STRAT, 
        [FRXETH], 
        [10 * 10**18],
        std
      )
    )

    # Deposit to redemption strategy
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_FRAX_ETH_REDEEM_STRAT, 
        [FRXETH], 
        [10 * 10**18],
        std
      )
    )

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(oeth_vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OETH supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

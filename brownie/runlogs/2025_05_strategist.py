# -------------------------------------
# May 2, 2025 - Deposit funds back to the Morpho Vaults
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    txs.append(vault_core.rebase(std))

    txs.append(vault_value_checker.takeSnapshot(std))

    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_META_USDC_STRAT,
        [usdc],
        [2_825_500 * 10**6],
        std
      )
    )

    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_GAUNTLET_PRIME_USDT_STRAT,
        [usdt],
        [1_662_800 * 10**6],
        std
      )
    )

    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_GAUNTLET_PRIME_USDC_STRAT,
        [usdc],
        [110_700 * 10**6],
        std
      )
    )

    profit = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(
      vault_value_checker.checkDelta(
        profit,
        (1 * 10**18),
        vault_change,
        (1 * 10**18),
        std
      )
    )

    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OETH supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

# -------------------------------------
# May 2, 2025 - Restore the default strategies
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:

    txs.append(
      vault_admin.setAssetDefaultStrategy(
        usdc,
        MORPHO_META_USDC_STRAT,
        std
      )
    )


    txs.append(
      vault_admin.setAssetDefaultStrategy(
        usdt,
        MORPHO_GAUNTLET_PRIME_USDT_STRAT,
        std
      )
    )



# -------------------------------------
# May 6, 2024 - Deposit 548 WETH to OETH Curve AMO
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # AMO pool before
    ethPoolBalance = oeth_metapool.balance()
    oethPoolBalance = oeth.balanceOf(OETH_METAPOOL)
    totalPool = ethPoolBalance + oethPoolBalance
    eth_out_before = oeth_metapool.get_dy(1, 0, 10 * 10**18)

    print("Curve OETH/ETH Pool before")  
    print("Pool ETH      ", "{:.6f}".format(ethPoolBalance / 10**18), ethPoolBalance * 100 / totalPool)
    print("Pool OETH ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total     ", "{:.6f}".format(totalPool / 10**18), totalPool)


    # Deposit WETH to Curve AMO
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [WETH],
        [548 * 10**18],
        {'from': STRATEGIST}
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


    # AMO pool after
    ethPoolBalance = oeth_metapool.balance()
    oethPoolBalance = oeth.balanceOf(OETH_METAPOOL)
    totalPool = ethPoolBalance + oethPoolBalance
    eth_out_after = oeth_metapool.get_dy(1, 0, 10 * 10**18)

    print("Curve OETH/ETH Pool after")  
    print("Pool ETH      ", "{:.6f}".format(ethPoolBalance / 10**18), ethPoolBalance * 100 / totalPool)
    print("Pool OETH ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total     ", "{:.6f}".format(totalPool / 10**18), totalPool)
    print("Sell 10 OETH Curve prices before and after", "{:.6f}".format(eth_out_before / 10**18), "{:.6f}".format(eth_out_after / 10**18))


# -------------------------------------
# May 12, 2024 - Deposit 10 WETH to new OETH Curve AMO
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # AMO pool before
    wethPoolBalance = weth.balanceOf(OETH_CURVE_POOL)
    oethPoolBalance = oeth.balanceOf(OETH_CURVE_POOL)
    totalPool = wethPoolBalance + oethPoolBalance
    weth_out_before = oeth_curve_pool.get_dy(1, 0, 10**18)

    print("Curve OETH/WETH Pool before")  
    print("Pool WETH  ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)


    # Deposit WETH to Curve AMO
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_CURVE_AMO_STRAT, 
        [WETH],
        [10 * 10**18],
        {'from': STRATEGIST}
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


    # AMO pool after
    wethPoolBalance = weth.balanceOf(OETH_CURVE_POOL)
    oethPoolBalance = oeth.balanceOf(OETH_CURVE_POOL)
    totalPool = wethPoolBalance + oethPoolBalance
    weth_out_after = oeth_curve_pool.get_dy(1, 0, 10**18)

    print("Curve OETH/ETH Pool after")  
    print("Pool WETH  ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)
    print("Sell 10 OETH Curve prices before and after", "{:.6f}".format(weth_out_before / 10**18), "{:.6f}".format(weth_out_after / 10**18))


# -------------------------------------------
# May 14 2025 - Withdraw from 1575 WETH from Convex AMO Strategy
# -------------------------------------------

from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # AMO pool before
    ethPoolBalance = oeth_metapool.balance()
    oethPoolBalance = oeth.balanceOf(OETH_METAPOOL)
    totalPool = ethPoolBalance + oethPoolBalance
    eth_out_before = oeth_metapool.get_dy(1, 0, 10**18)

    print("Curve OETH/ETH Pool before")  
    print("Pool ETH   ", "{:.6f}".format(ethPoolBalance / 10**18), ethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)


    # Remove WETH from strategy and burn equivalent OETH
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [weth], 
        [1575 * 10**18],
        {'from': STRATEGIST}
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


    # AMO pool after
    ethPoolBalance = oeth_metapool.balance()
    oethPoolBalance = oeth.balanceOf(OETH_METAPOOL)
    totalPool = ethPoolBalance + oethPoolBalance
    weth_out_after = oeth_metapool.get_dy(1, 0, 10**18)

    print("Curve OETH/ETH Pool after")  
    print("Pool WETH  ", "{:.6f}".format(ethPoolBalance / 10**18), ethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)
    print("Sell 10 OETH Curve prices before and after", "{:.6f}".format(eth_out_before / 10**18), "{:.6f}".format(weth_out_after / 10**18))

# -------------------------------------
# May 15, 2025 - Base Withdraw from Curve AMO strategy
# -------------------------------------
from world_base import *

def main():
  with TemporaryForkForOETHbReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({ 'from': OETHB_STRATEGIST }))
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_STRATEGIST }))

    print("----- Before rebalance -----")  
    print()
    amo_snapshot()  
    swapWeth = False
    swapAmount = 2_000e18
    minAmount = swapAmount * 0.98
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

    print("----- After rebalance && Before 2k WETH withdraw-----")  
    print()
    amo_snapshot()  

    
    # Withdraw 2k WETH
    wethWithdrawAmount = 2_025 * 10**18
    txs.append(
      vault_admin.withdrawFromStrategy(
        OETHB_AERODROME_AMO_STRATEGY, 
        [weth], 
        [wethWithdrawAmount], 
        {'from': OETHB_STRATEGIST}
      )
    )

    print("----- After 2k WETH withdraw -----")
    print()
    amo_snapshot()
    print("--------------------")
    print("WETH Withdraw ", c18(wethWithdrawAmount))

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), {'from': OETHB_STRATEGIST}))

    #amo_snapshot()
    print("--------------------")
    print("Profit       ", c18(profit), profit)
    print("Vault Change ", c18(vault_change), vault_change)

# -------------------------------------
# May 15, 2024 - Deposit 2025 WETH to BASE Curve AMO
# -------------------------------------
from aerodrome_harvest import *
from brownie import accounts
import eth_abi
def main():
  with TemporaryForkForReallocations() as txs:
    # Rebase
    txs.append(vault_core.rebase({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Take Vault snapshot 
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # AMO pool before
    wethPoolBalance = weth.balanceOf(CURVE_POOL_BASE)
    oethPoolBalance = oethb.balanceOf(CURVE_POOL_BASE)
    totalPool = wethPoolBalance + oethPoolBalance
    price_before = curve_pool.get_dy(1, 0, 10 * 10**18)

    print("Curve SuperOETH/WETH Pool before")  
    print("Pool WETH        ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool SuperOETH   ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total       ", "{:.6f}".format(totalPool / 10**18))
    print("-----")

    # Deposit 165 WETH to Curve AMO strategy
    txs.append(
      vault_admin.depositToStrategy(
        OETHB_CURVE_AMO_STRATEGY, 
        [weth],
        [2140 * 10**18],
        {'from': OETHB_MULTICHAIN_STRATEGIST}
      )
    )

    # AMO pool after
    wethPoolBalance = weth.balanceOf(CURVE_POOL_BASE)
    oethPoolBalance = oethb.balanceOf(CURVE_POOL_BASE)
    totalPool = wethPoolBalance + oethPoolBalance
    price_after = curve_pool.get_dy(1, 0, 10 * 10**18)

    print("Curve SuperOETH/WETH Pool after")  
    print("Pool WETH        ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool SuperOETH   ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total       ", "{:.6f}".format(totalPool / 10**18))
    print("SuperOETH/WETH Curve prices before and after", "{:.6f}".format(price_before / 10**19), "{:.6f}".format(price_after / 10**19))

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_MULTICHAIN_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_MULTICHAIN_STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (10 * 10**18), {'from': OETHB_MULTICHAIN_STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("SuperOETH supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")


# -------------------------------------------
# May 27 2025 - Deposit 2,163 WETH into Convex AMO Strategy
# -------------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # AMO pool before
    ethPoolBalance = oeth_metapool.balance()
    oethPoolBalance = oeth.balanceOf(OETH_METAPOOL)
    totalPool = ethPoolBalance + oethPoolBalance
    eth_out_before = oeth_metapool.get_dy(1, 0, 10**18)

    print("Curve OETH/ETH Pool before")  
    print("Pool ETH   ", "{:.6f}".format(ethPoolBalance / 10**18), ethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)

    # Deposit WETH to strategy
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [weth], 
        [2163 * 10**18],
        {'from': STRATEGIST}
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

    # AMO pool after
    ethPoolBalance = oeth_metapool.balance()
    oethPoolBalance = oeth.balanceOf(OETH_METAPOOL)
    totalPool = ethPoolBalance + oethPoolBalance
    weth_out_after = oeth_metapool.get_dy(1, 0, 10**18)

    print("Curve OETH/ETH Pool after")  
    print("Pool WETH  ", "{:.6f}".format(ethPoolBalance / 10**18), ethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)
    print("Sell 10 OETH Curve prices before and after", "{:.6f}".format(eth_out_before / 10**18), "{:.6f}".format(weth_out_after / 10**18))


# -------------------------------------------
# May 27 2025 - Harvest CRV from OETH and OUSD AMO strategies
# -------------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Collect CRV from OUSD Curve AMO strategy
    txs.append(
      ousd_curve_amo_strat.collectRewardTokens(
        {'from': STRATEGIST}
      )
    )

    # Collect CRV from OETH Curve AMO strategy
    txs.append(
      oeth_curve_amo_strat.collectRewardTokens(
        {'from': STRATEGIST}
      )
    )





# -------------------------------------
# July 1, 2025 - Withdraw from new Curve AMO and deposit to staking strategy
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
    weth_out_before = oeth_curve_pool.get_dy(0, 1, 10**18)

    print("Curve OETH/WETH Pool before")  
    print("Pool WETH  ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)

    # Withdraw 576 + 324 = 900 WETH from new Curve AMO
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_CURVE_AMO_STRAT,
        [WETH],
        [900 * 10**18],
        {'from': STRATEGIST}
      )
    )

    # Deposit WETH to Third Native Staking Strategy
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_NATIVE_STAKING_3_STRAT, 
        [WETH], 
        # 18 validator
        [576 * 10**18],
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

    # AMO pool after
    wethPoolBalance = weth.balanceOf(OETH_CURVE_POOL)
    oethPoolBalance = oeth.balanceOf(OETH_CURVE_POOL)
    totalPool = wethPoolBalance + oethPoolBalance
    weth_out_after = oeth_curve_pool.get_dy(0, 1, 10**18)

    print("Curve OETH/WETH Pool after")  
    print("Pool WETH  ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)
    print("Sell 10 OETH Curve prices before and after", "{:.6f}".format(weth_out_before / 10**18), "{:.6f}".format(weth_out_after / 10**18))

# -------------------------------------
# July 2, 2025 - Withdraw from new Curve AMO and deposit to staking strategy
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
    weth_out_before = oeth_curve_pool.get_dy(0, 1, 10**18)

    print("Curve OETH/WETH Pool before")  
    print("Pool WETH  ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)

    transfer_amount = 768 * 10**18  # 24 validators

    # Withdraw WETH from new Curve AMO
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_CURVE_AMO_STRAT,
        [WETH],
        [transfer_amount],
        {'from': STRATEGIST}
      )
    )

    # Deposit WETH to Third Native Staking Strategy
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_NATIVE_STAKING_3_STRAT, 
        [WETH], 
        [transfer_amount],
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

    # AMO pool after
    wethPoolBalance = weth.balanceOf(OETH_CURVE_POOL)
    oethPoolBalance = oeth.balanceOf(OETH_CURVE_POOL)
    totalPool = wethPoolBalance + oethPoolBalance
    weth_out_after = oeth_curve_pool.get_dy(0, 1, 10**18)

    print("Curve OETH/WETH Pool after")  
    print("Pool WETH  ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)
    print("Sell 10 OETH Curve prices before and after", "{:.6f}".format(weth_out_before / 10**18), "{:.6f}".format(weth_out_after / 10**18))

# -------------------------------------
# Jul 3, 2025 
# 1. one-sided remove of 830k USDC from Curve AMO
# 2. 1M USDC withdrawal from the Curve AMO strategy
# 3. Deposit 1.83M USDC to the Morpho Gauntlet Prime USDC strategy
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_core.rebase(std))
    txs.append(vault_value_checker.takeSnapshot(std))

    # AMO pool before
    usdcPoolBalance = usdc.balanceOf(OUSD_CURVE_POOL)
    ousdPoolBalance = ousd.balanceOf(OUSD_CURVE_POOL)
    totalPool = usdcPoolBalance * 10**12 + ousdPoolBalance
    price_before = ousd_curve_pool.get_dy(0, 1, 10 * 10**18)

    usdcVaultBalanceBefore = usdc.balanceOf(VAULT_PROXY_ADDRESS)

    print("Curve OUSD/USDC Pool before")  
    print("Pool USDC   ", "{:.6f}".format(usdcPoolBalance / 10**6), usdcPoolBalance * 10**12 * 100 / totalPool)
    print("Pool OUSD   ", "{:.6f}".format(ousdPoolBalance / 10**18), ousdPoolBalance * 100 / totalPool)
    print("Pool Total  ", "{:.6f}".format(totalPool / 10**18))

    # Remove USDC from the Curve pool
    curve_lp = 830000 * 10**18
    txs.append(
      ousd_curve_amo_strat.removeOnlyAssets(
        curve_lp,
        {'from': STRATEGIST}
      )
    )

    # Withdraw WETH from new Curve AMO
    txs.append(
      vault_admin.withdrawFromStrategy(
        OUSD_CURVE_AMO_STRAT,
        [USDC],
        [1000000 * 10**6],  # 1,000,000 USDC
        {'from': STRATEGIST}
      )
    )

    usdcVaultBalanceAfter = usdc.balanceOf(VAULT_PROXY_ADDRESS)
    usdcVaultBalanceDiff = usdcVaultBalanceAfter - usdcVaultBalanceBefore
    print("USDC Vault diff  ", "{:.6f}".format(usdcVaultBalanceDiff / 10**6))

    # Deposit USDC to Morpho Gauntlet Prime Strategy
    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_GAUNTLET_PRIME_USDC_STRAT,
        [usdc],
        [1_830_000 * 10**6],
        std
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OUSD supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

    # AMO pool after
    usdcPoolBalance = usdc.balanceOf(OUSD_CURVE_POOL)
    ousdPoolBalance = ousd.balanceOf(OUSD_CURVE_POOL)
    totalPool = usdcPoolBalance * 10**12 + ousdPoolBalance
    price_after = ousd_curve_pool.get_dy(0, 1, 10 * 10**18)

    print("Curve OUSD/USDC Pool after")  
    print("Pool USDC   ", "{:.6f}".format(usdcPoolBalance / 10**6), usdcPoolBalance * 10**12 * 100 / totalPool)
    print("Pool OUSD   ", "{:.6f}".format(ousdPoolBalance / 10**18), ousdPoolBalance * 100 / totalPool)
    print("Pool Total  ", "{:.6f}".format(totalPool / 10**18))
    print("OUSD/USDC Curve prices before and after", "{:.6f}".format(price_before / 10**7), "{:.6f}".format(price_after / 10**7))

# -------------------------------------------
# July 12, 2025 - Move 3800 WETH Convex AMO to Curve AMO
# -------------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Convex AMO pool before
    ethPoolBalance = oeth_metapool.balance()
    oethPoolBalance = oeth.balanceOf(OETH_METAPOOL)
    totalPool = ethPoolBalance + oethPoolBalance
    eth_out_before = oeth_metapool.get_dy(1, 0, 10**18)

    print("Curve OETH/ETH Pool before")  
    print("Pool ETH   ", "{:.6f}".format(ethPoolBalance / 10**18), ethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)

    # Curve AMO pool before
    wethPoolBalance = weth.balanceOf(OETH_CURVE_POOL)
    oethPoolBalance = oeth.balanceOf(OETH_CURVE_POOL)
    totalPool = wethPoolBalance + oethPoolBalance
    weth_out_before = oeth_curve_pool.get_dy(1, 0, 10**18)

    print("Curve OETH/WETH Pool before")  
    print("Pool WETH  ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)

    wethBalanceVaultBefore = weth.balanceOf(VAULT_OETH_PROXY_ADDRESS)

    withdrawAmount = 3800 * 10**18  # 3,800 ETH
    # Remove WETH from strategy and burn equivalent OETH
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [weth], 
        [withdrawAmount],
        {'from': STRATEGIST}
      )
    )

    depositAmount = withdrawAmount

    # Deposit WETH to Curve AMO
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_CURVE_AMO_STRAT, 
        [WETH],
        [depositAmount],
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

    # Convex AMO pool after
    ethPoolBalance = oeth_metapool.balance()
    oethPoolBalance = oeth.balanceOf(OETH_METAPOOL)
    totalPool = ethPoolBalance + oethPoolBalance
    weth_out_after = oeth_metapool.get_dy(1, 0, 10**18)

    print("Curve OETH/ETH Pool after")  
    print("Pool ETH   ", "{:.6f}".format(ethPoolBalance / 10**18), ethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)
    print("Sell 10 OETH Curve prices before and after", "{:.6f}".format(eth_out_before / 10**18), "{:.6f}".format(weth_out_after / 10**18))

    # Curve AMO pool after
    wethPoolBalance = weth.balanceOf(OETH_CURVE_POOL)
    oethPoolBalance = oeth.balanceOf(OETH_CURVE_POOL)
    totalPool = wethPoolBalance + oethPoolBalance
    weth_out_after = oeth_curve_pool.get_dy(1, 0, 10**18)

    print("Curve OETH/WETH Pool after")  
    print("Pool WETH  ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)
    print("Sell 10 OETH Curve prices before and after", "{:.6f}".format(weth_out_before / 10**18), "{:.6f}".format(weth_out_after / 10**18))


# -------------------------------------------
# July 18, 2025 - Move 300 WETH to Curve AMO
# -------------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Curve AMO pool before
    wethPoolBalance = weth.balanceOf(OETH_CURVE_POOL)
    oethPoolBalance = oeth.balanceOf(OETH_CURVE_POOL)
    totalPool = wethPoolBalance + oethPoolBalance
    weth_out_before = oeth_curve_pool.get_dy(1, 0, 10**18)

    print("Curve OETH/WETH Pool before")  
    print("Pool WETH  ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)

    wethBalanceVaultBefore = weth.balanceOf(VAULT_OETH_PROXY_ADDRESS)

    depositAmount = 300 * 10**18

    # Deposit WETH to Curve AMO
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_CURVE_AMO_STRAT, 
        [WETH],
        [depositAmount],
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

    # Curve AMO pool after
    wethPoolBalance = weth.balanceOf(OETH_CURVE_POOL)
    oethPoolBalance = oeth.balanceOf(OETH_CURVE_POOL)
    totalPool = wethPoolBalance + oethPoolBalance
    weth_out_after = oeth_curve_pool.get_dy(1, 0, 10**18)

    print("Curve OETH/WETH Pool after")  
    print("Pool WETH  ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)
    print("Sell 10 OETH Curve prices before and after", "{:.6f}".format(weth_out_before / 10**18), "{:.6f}".format(weth_out_after / 10**18))


# -------------------------------------
# July 18, 2025 - Claim validator withdrawal and deposit SwapX AMO on Sonic
# -------------------------------------
from world_sonic import *

def main():
  with TemporaryForkForReallocations() as txs:

    amount = 84000 * 10**18

    # Before
    txs.append(vault_core.rebase({'from': SONIC_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from': SONIC_STRATEGIST}))

    txs.append(
      sonic_staking_strat.withdrawFromSFC(
        44,
        {'from': SONIC_STRATEGIST}
      )
    )

    # Claim withdrawal from the Validator
    txs.append(
      vault_admin.depositToStrategy(
        SWAPX_AMO_STRATEGY, 
        [WS_SONIC],
        [amount],
        {'from': SONIC_STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(SONIC_STRATEGIST)[0]
    supply_change = os.totalSupply() - vault_value_checker.snapshots(SONIC_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (10 * 10**18), vault_change, (10 * 10**18), {'from': SONIC_STRATEGIST}))

    print("-----")
    print("Profit in wS", "{:.6f}".format(profit / 10**18), profit)
    print("OS supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("OS Vault change ", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

# -------------------------------------
# July 24, 2025 - Deposit 127 wS on SwapX AMO on Sonic
# -------------------------------------
from world_sonic import *

def main():
  with TemporaryForkForReallocations() as txs:

    amount = 127 * 10**18

    # Before
    txs.append(vault_core.rebase({'from': SONIC_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from': SONIC_STRATEGIST}))

    # Claim withdrawal from the Validator
    txs.append(
      vault_admin.depositToStrategy(
        SWAPX_AMO_STRATEGY, 
        [WS_SONIC],
        [amount],
        {'from': SONIC_STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(SONIC_STRATEGIST)[0]
    supply_change = os.totalSupply() - vault_value_checker.snapshots(SONIC_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (10 * 10**18), vault_change, (10 * 10**18), {'from': SONIC_STRATEGIST}))

    print("-----")
    print("Profit in wS", "{:.6f}".format(profit / 10**18), profit)
    print("OS supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("OS Vault change ", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

# -------------------------------------
# July 25, 2025 - Deposit 195.5k wS on SwapX AMO on Sonic
# -------------------------------------
from world_sonic import *

def main():
  with TemporaryForkForReallocations() as txs:

    amount = 195_500 * 10**18

    # Before
    txs.append(vault_core.rebase({'from': SONIC_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from': SONIC_STRATEGIST}))

    # Claim withdrawal from the Validator
    txs.append(
      vault_admin.depositToStrategy(
        SWAPX_AMO_STRATEGY, 
        [WS_SONIC],
        [amount],
        {'from': SONIC_STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(SONIC_STRATEGIST)[0]
    supply_change = os.totalSupply() - vault_value_checker.snapshots(SONIC_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (10 * 10**18), vault_change, (10 * 10**18), {'from': SONIC_STRATEGIST}))

    print("-----")
    print("Profit in wS", "{:.6f}".format(profit / 10**18), profit)
    print("OS supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("OS Vault change ", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

# -------------------------------------
# July 28, 2025 - Withdraw 2335 WETH from new Curve AMO
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
    weth_out_before = oeth_curve_pool.get_dy(0, 1, 10**18)

    print("Curve OETH/WETH Pool before")  
    print("Pool WETH  ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)

    amount_to_withdraw = 2335 * 10**18  # 2,335 WETH

    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_CURVE_AMO_STRAT,
        [WETH],
        [amount_to_withdraw],
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
    weth_out_after = oeth_curve_pool.get_dy(0, 1, 10**18)

    print("Curve OETH/WETH Pool after")  
    print("Pool WETH  ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)
    print("Sell 10 OETH Curve prices before and after", "{:.6f}".format(weth_out_before / 10**18), "{:.6f}".format(weth_out_after / 10**18))
"""


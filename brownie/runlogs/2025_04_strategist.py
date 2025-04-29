# -------------------------------------
# Apr 24, 2025 - Withdraw 100k USDC from OUSD Morpho Steakhouse and
# deposit to the new OUSD Curve AMO
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

    print("Curve OUSD/USDC Pool before")  
    print("Pool USDC   ", "{:.6f}".format(usdcPoolBalance / 10**6), usdcPoolBalance * 10**12 * 100 / totalPool)
    print("Pool OUSD   ", "{:.6f}".format(ousdPoolBalance / 10**18), ousdPoolBalance * 100 / totalPool)
    print("Pool Total  ", "{:.6f}".format(totalPool / 10**18))

    # Remove 100k USDC from Morpho Steakhouse Strategy
    txs.append(
      vault_admin.withdrawFromStrategy(
        MORPHO_META_USDC_STRAT, 
        [usdc], 
        [100000 * 10**6],
        {'from': STRATEGIST}
      )
    )

    # Deposit 100k USDC to Curve AMO
    txs.append(
      vault_admin.depositToStrategy(
        OUSD_CURVE_AMO_STRAT, 
        [usdc], 
        [100000 * 10**6],
        {'from': STRATEGIST}
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


# -------------------------------------
# Apr 24, 2025 - Remove and Burn OUSD from the OUSD/USDC Curve Pool
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

    print("Curve OUSD/USDC Pool before")  
    print("Pool USDC   ", "{:.6f}".format(usdcPoolBalance / 10**6), usdcPoolBalance * 10**12 * 100 / totalPool)
    print("Pool OUSD   ", "{:.6f}".format(ousdPoolBalance / 10**18), ousdPoolBalance * 100 / totalPool)
    print("Pool Total  ", "{:.6f}".format(totalPool / 10**18))

    # Remove and burn OUSD from the Curve pool
    curve_lp = 50000 * 10**18
    txs.append(
      ousd_curve_amo_strat.removeAndBurnOTokens(
        curve_lp,
        {'from': STRATEGIST}
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


# -------------------------------------
# Apr 29, 2025 - Deposit to third native staking strategy
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Deposit WETH to Third Native Staking Strategy
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_NATIVE_STAKING_3_STRAT, 
        [WETH], 
        # 8 validator
        [256 * 10**18],
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
# Apr 29, 2025 - Base deposit to Curve AMO strategy
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
        [165 * 10**18],
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
    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), {'from': OETHB_MULTICHAIN_STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("SuperOETH supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

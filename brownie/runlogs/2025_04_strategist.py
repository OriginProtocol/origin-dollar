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


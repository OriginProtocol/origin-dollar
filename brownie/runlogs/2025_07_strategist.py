
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

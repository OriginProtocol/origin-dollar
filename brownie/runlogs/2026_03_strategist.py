# -------------------------------------------------------------
# Mar 2, 2026 - Reallocate from Curve AMO Strategy to Compounding Staking Strategy
# -------------------------------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Withdraw from Curve AMO Strategy
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_CURVE_AMO_STRAT, 
        [WETH], 
        [(15 + 32) * 10**18],
        {'from': STRATEGIST}
      )
    )

    # Deposit WETH to Compounding Staking Strategy
    txs.append(
      vault_oeth_admin.depositToStrategy(
        COMPOUNDING_STAKING_SSV_STRAT, 
        [WETH],
        [32 * 10**18],
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
# Mar 2, 2026 - Withdraw 106 WETH from BASE Curve AMO for withdrawal requests
# -------------------------------------
from aerodrome_harvest import *
from brownie import accounts

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

    # Withdraw WETH from Curve AMO strategy
    txs.append(
      vault_admin.withdrawFromStrategy(
        OETHB_CURVE_AMO_STRATEGY, 
        [weth],
        [106 * 10**18],
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
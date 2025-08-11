
# -------------------------------------
# August 11, 2025 - Claim validator withdrawal and deposit SwapX AMO on Sonic
# -------------------------------------
from world_sonic import *

def main():
  with TemporaryForkForReallocations() as txs:

    amount = 330420 * 10**18

    # Before
    txs.append(vault_core.rebase({'from': SONIC_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from': SONIC_STRATEGIST}))

    txs.append(
      sonic_staking_strat.withdrawFromSFC(
        53,
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

    txs.append(vault_value_checker.checkDelta(profit, (10 * 10**18), vault_change, (100 * 10**18), {'from': SONIC_STRATEGIST}))

    print("-----")
    print("Profit in wS", "{:.6f}".format(profit / 10**18), profit)
    print("OS supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("OS Vault change ", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

# -------------------------------------
# August 11, 2024 - Deposit 246 WETH to BASE Curve AMO
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

    # Deposit WETH to Curve AMO strategy
    txs.append(
      vault_admin.depositToStrategy(
        OETHB_CURVE_AMO_STRATEGY, 
        [weth],
        [246 * 10**18],
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




# -------------------------------------------
# Mar 13 2025 - Rebalance the Curve AMO on Base
# -------------------------------------------

from aerodrome_harvest import *
from brownie import accounts
def main():
  with TemporaryForkForReallocations() as txs:

    strategist = accounts.at(MULTICHAIN_STRATEGIST, force=True)
    gas_buffer = 0.03 * 10**18

    # Rebase
    txs.append(vault_core.rebase({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Take Vault snapshot 
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # AMO pool before
    wethPoolBalance = weth.balanceOf(CURVE_POOL_BASE)
    oethPoolBalance = oethb.balanceOf(CURVE_POOL_BASE)
    totalPool = wethPoolBalance + oethPoolBalance
    extraOETH = oethPoolBalance - wethPoolBalance
    metapool_virtual_price = curve_pool.get_virtual_price()
    lp_tokens = (extraOETH * 10**18 / metapool_virtual_price) - 10**18
    superOETH_price_before = curve_pool.get_dy(1, 0, 100 * 10**18) / 100

    print("Curve SuperOETH/WETH Pool before")  
    print("Pool WETH       ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool SuperOETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total      ", "{:.6f}".format(totalPool / 10**18))
    print("Virtual price   ", "{:.6f}".format(metapool_virtual_price / 10**18), metapool_virtual_price)
    print("LP tokens       ", "{:.6f}".format(lp_tokens / 10**18))
    print("SuperOETH price ", "{:.6f}".format(superOETH_price_before / 10**18), superOETH_price_before)

    # remove the extra OETH to increase the price of SuperOETH in the SuperOETH/WETH Curve pool
    txs.append(
        curve_amo_strat.removeAndBurnOTokens(
        lp_tokens, 
        {'from': OETHB_MULTICHAIN_STRATEGIST}
        )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (0.1 * 10**18), {'from': STRATEGIST}))

    print("-----")
    snap_value = vault_value_checker.snapshots(STRATEGIST)[0]
    snap_supply = vault_value_checker.snapshots(STRATEGIST)[1]
    print("Snap value ", "{:.6f}".format(snap_value / 10**18), snap_value)
    print("Snap supply", "{:.6f}".format(snap_supply / 10**18), snap_supply)
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

    # AMO pool after
    wethPoolBalance = weth.balanceOf(CURVE_POOL_BASE)
    oethPoolBalance = oethb.balanceOf(CURVE_POOL_BASE)
    totalPool = wethPoolBalance + oethPoolBalance
    superOETH_price_after = curve_pool.get_dy(1, 0, 100 * 10**18) / 100

    print("Curve Pool after")  
    print("Pool ETH       ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool OETH      ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total     ", "{:.6f}".format(totalPool / 10**18), totalPool)

    print("-----")
    print("Burn LP amount",  "{:.6f}".format(lp_tokens / 10**18), lp_tokens)
    print("Sell 100 SuperOETH Curve prices before and after", "{:.6f}".format(superOETH_price_before / 10**18), "{:.6f}".format(superOETH_price_after / 10**18))

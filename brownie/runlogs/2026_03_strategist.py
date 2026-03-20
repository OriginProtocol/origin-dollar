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


# -------------------------------------------------------------
# Mar 12, 2026 - Withdraw 42 ETH from Curve AMO Strategy add 10 to Supernova AMO
#
# Note: As the Supernova pool didn't have enough initial liquidity it has been simulated that
# at least 5 OETH + 5 WETH needs to be added as liquidity to the pool for the modifier that 
# checks if the pool is balanced to not fail
# -------------------------------------------------------------

from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Directly add liquidity to the Supernova OETH/WETH pool as the strategist.
    supernova_pool = load_contract(
      "swapx_pool_pair",
      oeth_supernova_amo_strat.pool()
    )
    slippage_bps = 50  # 0.50%

    # Multichain strategist uses oeth_curve_pool to swap 5 OETH for WETH using its own balance
    oeth_swap_in = 5 * 10**18
    assert oeth.balanceOf(STRATEGIST) >= oeth_swap_in, "Not enough OETH for step 1 swap"
    min_weth_out = oeth_curve_pool.get_dy(0, 1, oeth_swap_in) * (10_000 - slippage_bps) // 10_000
    txs.append(oeth.approve(oeth_curve_pool.address, oeth_swap_in, std))
    txs.append(oeth_curve_pool.exchange(0, 1, oeth_swap_in, min_weth_out, std))

    #Multichain strategist deposists resulting WETH + OETH in proportional amounts into the Supernova pool
    reserve0, reserve1, _ = supernova_pool.getReserves()
    token0 = supernova_pool.token0().lower()
    weth_is_token0 = token0 == WETH.lower()
    weth_reserve = reserve0 if weth_is_token0 else reserve1
    oeth_reserve = reserve1 if weth_is_token0 else reserve0
    assert weth_reserve > 0 and oeth_reserve > 0, "Supernova pool has no reserves"

    strategist_weth = weth.balanceOf(STRATEGIST)
    strategist_oeth = oeth.balanceOf(STRATEGIST)
    deposit_weth = min(strategist_weth, (strategist_oeth * weth_reserve) // oeth_reserve)
    deposit_oeth = (deposit_weth * oeth_reserve) // weth_reserve
    assert deposit_weth > 0 and deposit_oeth > 0, "No proportional liquidity to deposit"

    # Approve both token transfers before deposit.
    txs.append(weth.approve(supernova_pool.address, deposit_weth, std))
    txs.append(oeth.approve(supernova_pool.address, deposit_oeth, std))

    txs.append(weth.transfer(supernova_pool.address, deposit_weth, std))
    txs.append(oeth.transfer(supernova_pool.address, deposit_oeth, std))
    txs.append(supernova_pool.mint(STRATEGIST, std))

    # Withdraw from Curve AMO Strategy
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_CURVE_AMO_STRAT, 
        [WETH], 
        [(42) * 10**18],
        {'from': STRATEGIST}
      )
    )

    # Deposit WETH to Compounding Staking Strategy
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_SUPERNOVA_AMO_STRAT, 
        [WETH],
        [10 * 10**18],
        std
      )
    )

    # Multichain strategist withdraws all of the liquidity proportionally from the pool
    lp_balance = supernova_pool.balanceOf(STRATEGIST)
    assert lp_balance > 0, "No Supernova LP balance for step 3"
    weth_before_withdraw = weth.balanceOf(STRATEGIST)
    txs.append(supernova_pool.transfer(supernova_pool.address, lp_balance, std))
    txs.append(supernova_pool.burn(STRATEGIST, std))
    weth_received_from_withdraw = weth.balanceOf(STRATEGIST) - weth_before_withdraw

    # Multichain strategist swap WETH bach into OETH
    weth_swap_in = 5 * 10**18
    assert weth_received_from_withdraw >= weth_swap_in, "Step 3 did not return enough WETH"
    min_oeth_out = oeth_curve_pool.get_dy(1, 0, weth_swap_in) * (10_000 - slippage_bps) // 10_000
    txs.append(weth.approve(oeth_curve_pool.address, weth_swap_in, std))
    txs.append(oeth_curve_pool.exchange(1, 0, weth_swap_in, min_oeth_out, std))

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
main()
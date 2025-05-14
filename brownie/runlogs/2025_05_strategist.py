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



# -------------------------------------
# May 14, 2025 - Unwrap wOETH to OETH, redeem and swap to WETH, and bridge to Base
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Unwrap wOETH to OETH
    woeth_amount = woeth.previewWithdraw((150 + 450) * 10**18)
    print("wOETH required", c18(woeth_amount), woeth_amount)

    # Redeem wOETH to OETH
    txs.append(
      woeth.redeem(woeth_amount, MULTICHAIN_STRATEGIST, MULTICHAIN_STRATEGIST, {'from': MULTICHAIN_STRATEGIST})
    )

    weth_before = weth.balanceOf(MULTICHAIN_STRATEGIST)

    # Swap OETH to WETH
    arm_amount = 449 * 10**18
    txs.append(
      oeth.approve(oeth_arm.address, arm_amount, {'from': MULTICHAIN_STRATEGIST})
    )
    txs.append(
      oeth_arm.swapExactTokensForTokens['address,address,uint256,uint256,address'](oeth.address, weth.address, arm_amount, arm_amount, MULTICHAIN_STRATEGIST, {'from': MULTICHAIN_STRATEGIST})
    )

    # Redeem OETH to WETH
    txs.append(
      oeth_vault_core.redeem(
        150 * 10**18,
        0,
        {'from': MULTICHAIN_STRATEGIST}
      )
    )

    # Hack to make weth.withdraw work
    brownie.network.web3.provider.make_request('hardhat_setCode', [MULTICHAIN_STRATEGIST, '0x'])
    
    weth_received = weth.balanceOf(MULTICHAIN_STRATEGIST) - weth_before

    print("--------------")
    print("WETH Received", c18(weth_received), weth_received)
    print("--------------")

    # Unwrap WETH
    txs.append(
      weth.withdraw(weth_received, {'from': MULTICHAIN_STRATEGIST})
    )
    
    # hex-encoded string for "originprotocol"
    extra_data = "0x6f726967696e70726f746f636f6c"

    # Bridge it
    txs.append(
      superbridge.bridgeETHTo(
        MULTICHAIN_STRATEGIST,
        200000, # minGasLimit
        extra_data, # extraData
        {'value': weth_received, 'from': MULTICHAIN_STRATEGIST}
      )
    )
    
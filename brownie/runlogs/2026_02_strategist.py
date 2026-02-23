# -------------------------------------------------------------
# Feb 16, 2026 - Allocate 100 USDC to the Crosschain strategy
# -------------------------------------------------------------
from world import *
def main():
  with TemporaryForkForReallocations() as txs:
    txs.append(vault_core.rebase({'from': MULTICHAIN_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from': MULTICHAIN_STRATEGIST}))

    txs.append(vault_admin.depositToStrategy(
      CROSSCHAIN_MORPHO_V2_BASE_MASTER_STRATEGY,
      [usdc],
      [100 * 10**6],
      {'from': MULTICHAIN_STRATEGIST}
    ))
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), {'from': MULTICHAIN_STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("USDC supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

# -------------------------------------------
# Feb 17 2026 - Add SSV to second and third Native Staking SSV Clusters
# -------------------------------------------

from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    amount = 228 * 10**18
    txs.append(
      ssv.transfer(
        OETH_NATIVE_STAKING_2_STRAT, 
        amount,
        {'from': STRATEGIST}
      )
    )

    # use the following command to get cluster info:
    # pnpm hardhat getClusterInfo --operatorids 752,753,754,755 --network mainnet --owner 0x4685dB8bF2Df743c861d71E6cFb5347222992076

    txs.append(
      native_staking_2_strat.depositSSV(
        # SSV Operator Ids
        [752, 753, 754, 755], 
        amount,
        # SSV Cluster details:
        # validatorCount, networkFeeIndex, index, active, balance
        [485, 416695837505, 9585132, True, 433293212143542776597],
        {'from': STRATEGIST}
      )
    )

    amount = 48 * 10**18
    txs.append(
      ssv.transfer(
        OETH_NATIVE_STAKING_3_STRAT, 
        amount,
        {'from': STRATEGIST}
      )
    )

    # use the following command to get cluster info:
    # pnpm hardhat getClusterInfo --operatorids 338,339,340,341 --network mainnet --owner 0xE98538A0e8C2871C2482e1Be8cC6bd9F8E8fFD63

    txs.append(
      native_staking_3_strat.depositSSV(
        # SSV Operator Ids
        [338, 339, 340, 341],
        amount,
        # SSV Cluster details:
        # validatorCount, networkFeeIndex, index, active, balance
        [88, 406033866602, 0, True, 93251662533120000000],
        {'from': STRATEGIST}
      )
    )

# -------------------------------------------
# Feb 19 2026 - Allocate 100k USDC to the Cross-chain strategy
# -------------------------------------------
from world import *
def main():
  with TemporaryForkForReallocations() as txs:
    txs.append(vault_core.rebase({'from': MULTICHAIN_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from': MULTICHAIN_STRATEGIST}))

    txs.append(vault_admin.withdrawFromStrategy(
      MORPHO_OUSD_V2_STRAT,
      [usdc],
      [189_000 * 10**6],
      {'from': MULTICHAIN_STRATEGIST}
    ))

    txs.append(vault_admin.depositToStrategy(
      CROSSCHAIN_MORPHO_V2_BASE_MASTER_STRATEGY,
      [usdc],
      [100_000 * 10**6],
      {'from': MULTICHAIN_STRATEGIST}
    ))
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), {'from': MULTICHAIN_STRATEGIST}))    
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("USDC supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

    vault_usdc = usdc.balanceOf(VAULT_PROXY_ADDRESS)
    print("USDC left in Vault", "{:.6f}".format(vault_usdc / 10**6), vault_usdc)


# -------------------------------------------
# Feb 23 2026 - Withdraw from Morpho v2 OUSD Strategy
# -------------------------------------------
from world import *
def main():
  with TemporaryForkForReallocations() as txs:
    txs.append(vault_core.rebase({'from': MULTICHAIN_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from': MULTICHAIN_STRATEGIST}))

    # AMO pool before
    usdcPoolBalance = usdc.balanceOf(OUSD_CURVE_POOL)
    ousdPoolBalance = ousd.balanceOf(OUSD_CURVE_POOL)
    totalPool = usdcPoolBalance * 10**12 + ousdPoolBalance
    # Sell OUSD
    assets_received = ousd_curve_pool.get_dy(0, 1, 10**18)
    # Buy OUSD
    oTokens_received = ousd_curve_pool.get_dy(1, 0, 10**6)

    print("Curve OUSD/USDC Pool before")  
    print("Pool USDC   ", "{:.6f}".format(usdcPoolBalance / 10**6), usdcPoolBalance * 10**12 * 100 / totalPool)
    print("Pool OUSD   ", "{:.6f}".format(ousdPoolBalance / 10**18), ousdPoolBalance * 100 / totalPool)
    print("Pool Total  ", "{:.6f}".format(totalPool / 10**18))
    print("OUSD buy price ", "{:.6f}".format(10**18 / oTokens_received))
    print("OUSD sell price", "{:.6f}".format(assets_received / 10**6 ))

    # Remove and burn OUSD from the Curve pool
    curve_lp = 700000 * 10**18
    txs.append(
      ousd_curve_amo_strat.removeAndBurnOTokens(
        curve_lp,
        {'from': STRATEGIST}
      )
    )

    txs.append(vault_admin.withdrawFromStrategy(
      MORPHO_OUSD_V2_STRAT,
      [usdc],
      [28204 * 10**6],
      {'from': MULTICHAIN_STRATEGIST}
    ))

    # AMO pool after
    usdcPoolBalance = usdc.balanceOf(OUSD_CURVE_POOL)
    ousdPoolBalance = ousd.balanceOf(OUSD_CURVE_POOL)
    totalPool = usdcPoolBalance * 10**12 + ousdPoolBalance
    # Sell OUSD
    assets_received = ousd_curve_pool.get_dy(0, 1, 10**18)
    # Buy OUSD
    oTokens_received = ousd_curve_pool.get_dy(1, 0, 10**6)

    print("-----")
    print("Curve OUSD/USDC Pool after")  
    print("Pool USDC   ", "{:.6f}".format(usdcPoolBalance / 10**6), usdcPoolBalance * 10**12 * 100 / totalPool)
    print("Pool OUSD   ", "{:.6f}".format(ousdPoolBalance / 10**18), ousdPoolBalance * 100 / totalPool)
    print("Pool Total  ", "{:.6f}".format(totalPool / 10**18))
    print("OUSD buy price ", "{:.6f}".format(10**18 / oTokens_received))
    print("OUSD sell price", "{:.6f}".format(assets_received / 10**6 ))

    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), {'from': MULTICHAIN_STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OUSD supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

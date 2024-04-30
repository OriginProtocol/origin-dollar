
# -------------------------------------
# Apr 2, 2024 - OETH Reallocation
# -------------------------------------
from collateralSwap import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Withdraw 1,510 WETH & 1,105 rETH from Balancer AMO
    txs.append(
      oeth_vault_admin.withdrawFromStrategy(
        BALANCER_RETH_STRATEGY, 
        [weth, reth], 
        [1510 * 10**18, 1105 * 10**18], 
        std
      )
    )
    # Swap 1,105 rETH for WETH with 0.1% tolerance
    _, swap_data = build_swap_tx(RETH, WETH, 1105 * 10**18, 0.1, False)
    decoded_input = oeth_vault_core.swapCollateral.decode_input(swap_data)
    txs.append(
      oeth_vault_core.swapCollateral(*decoded_input, {'from':STRATEGIST})
    )

    # withdraw 3,500 WETH from the Morpho Aave
    txs.append(
        vault_oeth_admin.withdrawFromStrategy(
        OETH_MORPHO_AAVE_STRAT, 
        [WETH], 
        [3560 * 10**18],
        std
        )
    )

    eth_out_before = oeth_metapool.get_dy(1, 0, 3788 * 10**18)

    # deposit 6,288 WETH to the AMO
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [WETH], 
        [6288 * 10**18],
        std
      )
    )
    # remove the 6288 OETH that was previously minted from the Curve pool and burn
    metapool_virtual_price = 1001356965186134816
    lp_amount = 6288 * 10**18 * 10**18 / metapool_virtual_price
    txs.append(
        oeth_meta_strat.removeAndBurnOTokens(
        lp_amount, 
        std
        )
    )
    eth_out_after = oeth_metapool.get_dy(1, 0, 3788 * 10**18)

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
    print("burn LP amount",  "{:.6f}".format(lp_amount / 10**18), lp_amount)
    print("ETH from Curve swap of 3788 OETH before", "{:.6f}".format(eth_out_before / 10**18), eth_out_before)
    print("ETH from Curve swap of 3788 OETH after", "{:.6f}".format(eth_out_after / 10**18), eth_out_after)

# -------------------------------------
# Apr 11, 2024 - OETH Buyback
# -------------------------------------
from buyback import *
def main():
  txs = []

  oeth_for_ogv, oeth_for_cvx = get_balance_splits(OETH)

  with TemporaryFork():
    txs.append(
      build_1inch_buyback_tx(
        OETH,
        OGV,
        oeth_for_ogv,
        3
      )
    )

    txs.append(
      build_1inch_buyback_tx(
        OETH,
        CVX,
        oeth_for_cvx,
        1
      )
    )

    txs.append(
      cvx_locker.processExpiredLocks(True, std)
    )

    print(to_gnosis_json(txs))

# -------------------------------------
# Apr 11, 2024 - OUSD Buyback
# -------------------------------------
from buyback import *
def main():
  txs = []

  ousd_for_ogv, ousd_for_cvx = get_balance_splits(OUSD)

  with TemporaryFork():
    txs.append(
      build_1inch_buyback_tx(
        OUSD,
        OGV,
        ousd_for_ogv,
        3
      )
    )

    txs.append(
      build_1inch_buyback_tx(
        OUSD,
        CVX,
        ousd_for_cvx,
        1
      )
    )

    print(to_gnosis_json(txs))

# -------------------------------------
# Apr 12, 2024 - FraxETH Redeem
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))
    
    print("Outstanding redeems before:", frxeth_redeem_strat.outstandingRedeems())

    txs.append(
      frxeth_redeem_strat.redeemTickets(
        [
          205, 212, 213, 214, 215, 220, 221, 222, 223, 224, 225, 226, 
          227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 
          239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 
          251, 252, 253, 254, 255, 256, 257, 258, 259,
        ],
        11010 * 10**18,
        std
      )
    )

    print("Outstanding redeems after:", frxeth_redeem_strat.outstandingRedeems())

    # Deposit WETH to Morpho Aave
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_MORPHO_AAVE_STRAT, 
        [WETH], 
        [11010 * 10**18],
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
# Apr 12, 2024 - Queue More frxETH
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Withdraw all frxETH from FrxETHStrategy
    txs.append(
      vault_oeth_admin.withdrawAllFromStrategy(
        OETH_FRAX_ETH_STRAT,
        std
      )
    )

    # Queue everything on the redemption strategy
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_FRAX_ETH_REDEEM_STRAT, 
        [FRXETH], 
        [frxeth.balanceOf(OETH_VAULT)],
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
# Apr 23, 2024 - FraxETH Redeem
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    outstanding_redeems = frxeth_redeem_strat.outstandingRedeems();
    
    print("Outstanding redeems before:", outstanding_redeems)

    txs.append(
      frxeth_redeem_strat.redeemTickets(
        [
          350, 351, 352, 353, 354, 355, 356, 357, 358,
          359, 360, 361, 362, 363, 364, 365, 366
        ],
        outstanding_redeems,
        std
      )
    )

    print("Outstanding redeems after:", frxeth_redeem_strat.outstandingRedeems())

    # Deposit WETH to Morpho Aave
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_MORPHO_AAVE_STRAT, 
        [WETH], 
        [outstanding_redeems],
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
# Apr 24, 2024 - OETH Buyback
# -------------------------------------
from buyback import *
def main():
  txs = []

  oeth_for_ogv, oeth_for_cvx = get_balance_splits(OETH)

  with TemporaryFork():
    txs.append(
      build_1inch_buyback_tx(
        OETH,
        OGV,
        oeth_for_ogv,
        3
      )
    )

    txs.append(
      build_1inch_buyback_tx(
        OETH,
        CVX,
        oeth_for_cvx,
        2
      )
    )

    txs.append(
      cvx_locker.processExpiredLocks(True, std)
    )

    print(to_gnosis_json(txs))

# -------------------------------------
# Apr 24, 2024 - Get some stETH
# -------------------------------------
from collateralSwap import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Withdraw 4607 WETH from Morpho Aave
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_MORPHO_AAVE_STRAT, 
        [WETH], 
        [4607 * 10**18],
        std
      )
    )

    # Swap to stETH
    _, swap_data = build_swap_tx(WETH, STETH, 4600 * 10**18, 0.2, False)
    decoded_input = oeth_vault_core.swapCollateral.decode_input(swap_data)
    txs.append(
      oeth_vault_core.swapCollateral(*decoded_input, std)
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
# Apr 24, 2024 - OUSD Buyback
# -------------------------------------
from buyback import *
def main():
  txs = []

  ousd_for_ogv, ousd_for_cvx = get_balance_splits(OUSD)

  with TemporaryFork():
    txs.append(
      build_1inch_buyback_tx(
        OUSD,
        OGV,
        ousd_for_ogv,
        3
      )
    )

    txs.append(
      build_1inch_buyback_tx(
        OUSD,
        CVX,
        ousd_for_cvx,
        2
      )
    )

    print(to_gnosis_json(txs))

# -------------------------------------
# Apr 26, 2024 - Get some stETH
# -------------------------------------
from collateralSwap import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Withdraw WETH from Morpho Aave
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_MORPHO_AAVE_STRAT, 
        [WETH], 
        [6580 * 10**18],
        std
      )
    )

    # Swap to stETH
    _, swap_data = build_swap_tx(WETH, STETH, 6357 * 10**18, 0.004, False)
    decoded_input = oeth_vault_core.swapCollateral.decode_input(swap_data)
    txs.append(
      oeth_vault_core.swapCollateral(*decoded_input, std)
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

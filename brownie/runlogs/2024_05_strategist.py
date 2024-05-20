
# -------------------------------------
# May 6, 2024 - OETH Reallocation
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))


    eth_out_before = oeth_metapool.get_dy(1, 0, 100 * 10**18)
    balances_before = oeth_metapool.get_balances()

    # remove the 10k OETH to increase the price of OETH in the OETH/ETH Curve pool
    metapool_virtual_price = 1001445329258618599
    lp_amount = 10_050 * 10**18 * 10**18 / metapool_virtual_price
    txs.append(
        oeth_meta_strat.removeAndBurnOTokens(
        lp_amount, 
        std
        )
    )

    eth_out_after = oeth_metapool.get_dy(1, 0, 100 * 10**18)
    balances_after = oeth_metapool.get_balances()

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
    print("Burn LP amount",  "{:.6f}".format(lp_amount / 10**18), lp_amount)
    print("Sell 100 OETH Curve prices before and after", "{:.6f}".format(eth_out_before / 10**18), "{:.6f}".format(eth_out_after / 10**18))
    print("Curve ETH and OETH balances before",  "{:.6f}".format(balances_before[0] / 10**18), "{:.6f}".format(balances_before[1] / 10**18))
    print("Curve ETH and OETH balances after",  "{:.6f}".format(balances_after[0] / 10**18), "{:.6f}".format(balances_after[1]  / 10**18))

# -------------------------------------
# May 6, 2024 - rETH to stETH
# -------------------------------------
from collateralSwap import *

def main():
  with TemporaryForkForReallocations() as txs:
    try:
      # Before
      txs.append(vault_oeth_core.rebase(std))
      txs.append(oeth_vault_value_checker.takeSnapshot(std))
      
      # Withdraw all WETH from Morpho Aave
      txs.append(
        vault_oeth_admin.withdrawAllFromStrategy(
          OETH_MORPHO_AAVE_STRAT, 
          std
        )
      )

      # Swap all rETH to stETH
      # Full sweep fails, so leaves some dust
      reth_balance = reth.balanceOf(VAULT_OETH_PROXY_ADDRESS) - 1e4
      _, swap_data = build_swap_tx(RETH, STETH, reth_balance, 0.1, False)
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
    except:
      brownie.chain.revert()

# -------------------------------------
# May 08, 2024 - OETH Buyback
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
# May 08, 2024 - OUSD Buyback
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
# May 17, 2024 - frxETH to WETH
# -------------------------------------
from collateralSwap import *

def main():
  with TemporaryForkForReallocations() as txs:
    try:
      # Before
      txs.append(vault_oeth_core.rebase(std))
      txs.append(oeth_vault_value_checker.takeSnapshot(std))

      # Swap all frxETH to WETH
      # Full sweep fails, so leaves some dust
      frxeth_balance = frxeth.balanceOf(VAULT_OETH_PROXY_ADDRESS) 
      print("frxETH to swap", "{:.6f}".format(frxeth_balance / 10**18))
      _, swap_data = build_swap_tx(FRXETH, WETH, frxeth_balance, 0.1, False)
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
    except:
      brownie.chain.revert()

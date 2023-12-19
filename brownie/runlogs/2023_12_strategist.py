# -------------------------------------
# Dec 06, 2023 - OETH Buyback
# -------------------------------------
from buyback import *

def main():
  txs = []

  with TemporaryFork():
    txs.append(
      build_buyback_tx(
        OETH,
        oeth.balanceOf(OETH_BUYBACK),
        max_ogv_slippage=1.25,
        max_cvx_slippage=2.5
      )
    )

    print(to_gnosis_json(txs))

# -------------------------------------
# Dec 06, 2023 - OUSD Buyback
# -------------------------------------
from buyback import *

def main():
  txs = []

  with TemporaryFork():
    txs.append(
      build_buyback_tx(
        OUSD,
        ousd.balanceOf(OUSD_BUYBACK),
        max_ogv_slippage=1.25,
        max_cvx_slippage=3
      )
    )

    print(to_gnosis_json(txs))

# -------------------------------------
# Dec 13, 2023 - OETH AMO Burn
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Target to burn 7,316.20292985802 OETH
    # Remove 7,300 LP Tokens (~7,318 OETH)
    txs.append(oeth_meta_strat.removeAndBurnOTokens(7300 * 1e18, std))

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (0.1 * 10**18), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")


# -------------------------------------
# Dec 19, 2023 - OETH Reallocation
# -------------------------------------
from world import *
from collateralSwap import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    
    # Withdraw 1,217.146 WETH and 1,064.393 rETH
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        BALANCER_RETH_STRATEGY, 
        [reth, weth], 
        [1_064.393 * 10**18, 1_217.146 * 10**18], 
        {'from': STRATEGIST}
      )
    )

    #print("Balance of RETH: ", reth.balanceOf(oeth_vault_core) / 1e18)

    # Swap 1_064.393 rETH for 1163.270 WETH with 0.6% tolerance
    _, swap_data = build_swap_tx(RETH, WETH, 1064393 * 10**15, 0.6, False)
    decoded_input = oeth_vault_admin.swapCollateral.decode_input(swap_data)
    txs.append(
      oeth_vault_admin.swapCollateral(*decoded_input, {'from':STRATEGIST})
    )

    print("Balance of AMO before: ", oeth_meta_strat.checkBalance(WETH) / 1e18)
    print("oeth supply before", oeth.totalSupply())
    # Deposit 2,380.416 ETH to Convex AMO
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [WETH], 
        [2_380.416 * 10**18], 
        {'from': STRATEGIST}
      )
    )
    print(txs[-1].call_trace(True))
    print("oeth supply after", oeth.totalSupply())
    print("Balance of AMO after: ", oeth_meta_strat.checkBalance(WETH) / 1e18)

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    print("vault_change", vault_change)
    print("supply_change", supply_change)
    print("profit", profit)
    print("snapshot totalSupply", oeth_vault_value_checker.snapshots(STRATEGIST)[1])
    txs.append(oeth_vault_value_checker.checkDelta(profit, (0.2 * 10**18), vault_change, (0.2 * 10**18), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

main()

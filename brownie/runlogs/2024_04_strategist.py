
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
    txs.append(
        oeth_meta_strat.removeAndBurnOTokens(
        6288 * 10**18 * 10**18 / metapool_virtual_price, 
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
    print("ETH from Curve swap of 3788 OETH before", "{:.6f}".format(eth_out_before / 10**18), eth_out_before)
    print("ETH from Curve swap of 3788 OETH after", "{:.6f}".format(eth_out_after / 10**18), eth_out_after)

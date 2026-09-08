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
# Dec 20, 2023 - OETH Buyback
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
        max_cvx_slippage=3
      )
    )

    print(to_gnosis_json(txs))


# -------------------------------------
# Dec 20, 2023 - OUSD Buyback
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
# Dec 20, 2023 - OETH Reallocation
# -------------------------------------
from world import *
#from collateralSwap import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Deposit 2,026..416 ETH to Convex AMO
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [WETH], 
        [2_026.30298717216 * 10**18], 
        {'from': STRATEGIST}
      )
    )

    # below line works on hardhat's default node (brownie console --network mainnet-fork)
    # but not on our default node running in a separate terminal and attaching
    # to it: (brownie console --network hardhat)
    #print(txs[-1].call_trace(True))

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    print("profit", profit)
    print("snapshot totalSupply", oeth_vault_value_checker.snapshots(STRATEGIST)[1])
    txs.append(oeth_vault_value_checker.checkDelta(profit, (0.2 * 10**18), vault_change, (0.2 * 10**18), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

main()
# Dec 22, 2023 - WETH <> stETH
# -------------------------------------
from collateralSwap import *

txs = []

def main():
  with TemporaryFork():
    # Before
    txs.append(oeth_vault_core.rebase({'from':STRATEGIST}))
    txs.append(oeth_vault_value_checker.takeSnapshot({'from':STRATEGIST}))

    # Swap 50 WETH for stETH with 0.1% tolerance
    txs.append(
      build_swap_tx(
        WETH, 
        STETH, 
        1426.65 * 10**18, 
        0.1, 
        False, 
        dry_run=False)
    )

    # After
    vault_change = oeth_vault_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (0.1 * 10**18), {'from': STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

    print(to_gnosis_json(txs))

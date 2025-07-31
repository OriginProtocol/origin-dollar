
# -------------------------------
# Aug 2, 2024 - OUSD Allocation
# -------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({'from':STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from':STRATEGIST}))

    # Withdraw 100k from Morpho Aave
    txs.append(
      vault_admin.withdrawFromStrategy(
        MORPHO_AAVE_STRAT, 
        [usdt], 
        [100_000 * 10**6], 
        {'from': STRATEGIST}
      )
    )

    # Put everything in Aave
    txs.append(
      vault_admin.depositToStrategy(
        AAVE_STRAT, 
        [usdt], 
        [100_000*10**6], 
        {'from': STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (500 * 10**18), vault_change, (500 * 10**18), {'from': STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)


# -------------------------------------
# Aug 2, 2024 - Deposit 512 WETH to the Second Native Staking Strategy
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Deposit WETH to Native Staking Strategy
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_NATIVE_STAKING_2_STRAT, 
        [WETH], 
        # 16 validator
        [512 * 10**18],
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
# Aug 9, 2024 - Rebalance AMO by burning 6k OETH
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
    metapool_virtual_price = 1001660590199848614
    lp_amount = 6_000 * 10**18 * 10**18 / metapool_virtual_price
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

    # Call rebase again to lock in the profit
    txs.append(vault_oeth_core.rebase(std))

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
# Aug 19, 2024 - OETH Buyback
# -------------------------------------
from buyback import *
def main():
  txs = []

  oeth_for_ogn, oeth_for_cvx = get_balance_splits(OETH)

  with TemporaryFork():
    txs.append(
      build_1inch_buyback_tx(
        OETH,
        OGN,
        oeth_for_ogn,
        3.5
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
# Aug 19, 2024 - OUSD Buyback
# -------------------------------------
from buyback import *
def main():
  txs = []

  ousd_for_ogn, ousd_for_cvx = get_balance_splits(OUSD)

  with TemporaryFork():
    txs.append(
      build_1inch_buyback_tx(
        OUSD,
        OGN,
        ousd_for_ogn,
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

# -------------------------------
# Aug 22, 2024 - OUSD Allocation
# -------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({'from':STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from':STRATEGIST}))

    # Withdraw 792k USDT from Morpho Aave
    txs.append(
      vault_admin.withdrawFromStrategy(
        MORPHO_AAVE_STRAT, 
        [usdt], 
        [316_000 * 10**6], 
        {'from': STRATEGIST}
      )
    )

    # Put everything in Aave
    txs.append(
      vault_admin.depositToStrategy(
        AAVE_STRAT, 
        [usdt], 
        [316_000*10**6], 
        {'from': STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (500 * 10**18), vault_change, (500 * 10**18), {'from': STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)


# -------------------------------------------
# Aug 29 2024 - OETHb allocation & rebalance
# -------------------------------------------
from world_base import *

def main():
  with TemporaryForkForOETHbReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({'from':OETHB_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from':OETHB_STRATEGIST}))

    # Deposit 100 WETH
    txs.append(
      vault_admin.depositToStrategy(
        OETHB_AERODROME_AMO_STRATEGY, 
        [weth], 
        [100 * 10**18], 
        {'from': OETHB_STRATEGIST}
      )
    )

    txs.append(
      amo_strat.rebalance(
        3.8 * 10**18, 
        False,
        0 * 10**18,
        {'from': OETHB_STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (500 * 10**18), vault_change, (500 * 10**18), {'from': OETHB_STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

# -------------------------------------
# Aug 30, 2024 - OETH Buyback
# -------------------------------------
from buyback import *
def main():
  txs = []

  oeth_for_ogn, oeth_for_cvx = get_balance_splits(OETH)

  with TemporaryFork():
    txs.append(
      build_1inch_buyback_tx(
        OETH,
        OGN,
        oeth_for_ogn,
        3.5
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
# Aug 30, 2024 - OUSD Buyback
# -------------------------------------
from buyback import *
def main():
  txs = []

  ousd_for_ogn, ousd_for_cvx = get_balance_splits(OUSD)

  with TemporaryFork():
    txs.append(
      build_1inch_buyback_tx(
        OUSD,
        OGN,
        ousd_for_ogn,
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
# Aug 30, 2024 - OUSD Buyback
# -------------------------------------
from aerodrome_harvest import *
def main():
    harvest_and_swap()
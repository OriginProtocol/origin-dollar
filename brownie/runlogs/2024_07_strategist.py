# -------------------------------------
# Jul 04, 2024 - OETH Buyback
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
# Jul 04, 2024 - OUSD Buyback
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
# Jul 5, 2024 - Second deposit to Native Staking Strategy
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
        OETH_NATIVE_STAKING_STRAT, 
        [WETH], 
        [740 * 10**18],
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
# Jul 9, 2024 - First deposit to Lido Withdrawal Strategy
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))
    
    # Deposit 1 stETH to Lido Withdrawal Strategy
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_LIDO_WITHDRAWAL_STRAT, 
        [STETH], 
        [1 * 10**18],
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
# Jul 9, 2024 - Claim first withdrawal from Lido Withdrawal Strategy
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))
    
    # Claim the 1 ETH from the Lido Withdrawal Queue
    txs.append(
      lido_withdrawal_strat.claimWithdrawals(
        [45153], # withdrawal NFT id
        10**18 - 2,
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
# Jul 10, 2024 - deposit to Native Staking Strategy
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
        OETH_NATIVE_STAKING_STRAT, 
        [WETH], 
        # 43 validators * 32 ETH = 1376 ETH
        [1376 * 10**18],
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
# Jul 10, 2024 - Deposit 4992 stETH to Lido Withdrawal Strategy
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Deposit 156 validators * 32 ETH = 4992 WETH
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_LIDO_WITHDRAWAL_STRAT, 
        [STETH], 
        [4992 * 10 **18],
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
# Jul 10, 2024 - Claim second batch of withdrawals from Lido Withdrawal Strategy
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))
    
    # Claim the 5 withdrawal requests from the Lido Withdrawal Queue
    txs.append(
      lido_withdrawal_strat.claimWithdrawals(
        [45270, 45271, 45272, 45273, 45274], # withdrawal NFT ids
        4992 * 10**18,
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
# Jul 10, 2024 - Deposit all stETH to Lido Withdrawal Strategy
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))
    
    # Deposit 156 validators * 32 ETH = 4992 WETH
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_LIDO_WITHDRAWAL_STRAT, 
        [STETH], 
        [4992 * 10 **18],
        std
      )
    )

    steth_remaining = steth.balanceOf(OETH_VAULT)

    # deposit of the remaining stETH
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_LIDO_WITHDRAWAL_STRAT, 
        [STETH], 
        [steth_remaining],
        std
      )
    )

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(oeth_vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), std))
    print("stETH remaining", "{:.6f}".format(steth_remaining / 10**18), steth_remaining)
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OETH supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

# -------------------------------------
# Jul 11, 2024 - Claim withdrawals from Lido Withdrawal Strategy
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))
    
    # Claim the withdrawal requests from the Lido Withdrawal Queue
    expected_amount = (4992 + 7000) * 10**18 + 914635193689940225665 + 5
    txs.append(
      lido_withdrawal_strat.claimWithdrawals(
        # withdrawal NFT IDs in tx 0x3d43421cc03b8c6580eba42e4e3f85b1e9b7c82d94c5d28a9f62777775ed2dc9
        [45345, 45346, 45347, 45348, 45349, 45350, 45351, 45352, 45353, 45354, 45355, 45356, 45357],
        expected_amount,
        std
      )
    )

    # Deposit WETH to Native Staking Strategy
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_NATIVE_STAKING_STRAT, 
        [WETH], 
        # (500 max validators - 243 existing validators) * 32 = 8,224 ETH
        [8224 * 10**18],
        std
      )
    )

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(oeth_vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), std))
    print("-----")
    print("Expected amount", "{:.6f}".format(expected_amount / 10**18), expected_amount)
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OETH supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

# -------------------------------------
# Jul 12, 2024 - Deposit 96 WETH to Native Staking Strategy
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
        OETH_NATIVE_STAKING_STRAT, 
        [WETH], 
        # 3 existing validators * 32 = 96 ETH
        [96 * 10**18],
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
# Jul 12, 2024 - Deposit 32 WETH to Native Staking Strategy
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
        OETH_NATIVE_STAKING_STRAT, 
        [WETH], 
        # 1 more validator
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
# July 15, 2024 - rETH to WETH
# -------------------------------------
from collateralSwap import *

def main():
  with TemporaryForkForReallocations() as txs:
    try:
      # Before
      txs.append(vault_oeth_core.rebase(std))
      txs.append(oeth_vault_value_checker.takeSnapshot(std))

      # Swap all rETH to WETH
      # Full sweep fails, so leaves some dust
      reth_balance = reth.balanceOf(VAULT_OETH_PROXY_ADDRESS) - 1e8
      _, swap_data = build_swap_tx(RETH, WETH, reth_balance, 0.1, False)
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
# Jul 16, 2024 - OETH Buyback
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
# Jul 16, 2024 - OUSD Buyback
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
# Jul 18, 2024 - Deposit 128 WETH to second Native Staking Strategy
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
        # 4 validators
        [128 * 10**18],
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
# Jul 18, 2024 - Deposit 4k WETH to second Native Staking Strategy
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
        # 125 validators
        [4000 * 10**18],
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
# Jul 30, 2024 - OETH Buyback
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
# Jul 30, 2024 - OUSD Buyback
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
# Jul 30, 2024 - OUSD Allocation
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

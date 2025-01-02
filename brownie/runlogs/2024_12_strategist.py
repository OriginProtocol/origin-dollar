# -------------------------------------
# Dec 27, 2024 - Withdraw from 3rd Native Staking Strategy and Deposit to AMO
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Remove 736 WETH from 3rd Native Staking Strategy
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_NATIVE_STAKING_3_STRAT, 
        [weth], 
        [1440 * 10**18],
        {'from': STRATEGIST}
      )
    )

    # Deposit WETH to AMO
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [WETH],
        [1440 * 10**18],
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

# -------------------------------------
# Dec 31, 2024 - Gauntlet Prime USDT and USDC
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    txs.append(vault_core.rebase(std))

    txs.append(vault_value_checker.takeSnapshot(std))

    txs.append(
      vault_admin.withdrawFromStrategy(
        AAVE_STRAT,
        [usdt],
        [8000 * 10**6],
        std
      )
    )

    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_GAUNTLET_PRIME_USDT_STRAT,
        [usdt],
        [10_000 * 10**6],
        std
      )
    )

    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_GAUNTLET_PRIME_USDC_STRAT,
        [usdc],
        [10_000 * 10**6],
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
# Dec 31, 2024 - Deposit incentives and lock Aero
# -------------------------------------
from aerodrome_harvest import *

def main():
  with TemporaryForkForOETHbReallocations() as txs:
    # amount = aero.balanceOf(OETHB_STRATEGIST)
    amount = 150_000 * 10**18

    # Approve the bribes contract to move it
    txs.append(
        aero.approve(OETHB_WETH_BRIBE_CONTRACT, amount, from_strategist)
    )

    # Bribe
    txs.append(
      oethb_weth_bribe.notifyRewardAmount(
        AERO_BASE,
        amount,
        from_strategist
      )
    )

    # Approve the veaero contract to move it
    txs.append(
      aero.approve(VEAERO_BASE, amount, from_strategist)
    )

    lock_amount = 5000 * 10**18
    num_locks = 30
    for i in range(0, num_locks):
      # Create a lock of 5k AERO for 4 years
      txs.append(
        veaero.createLock(
          lock_amount,
          365.25 * 4 * 24 * 60 * 60, # 4 years
          from_strategist
        )
      )
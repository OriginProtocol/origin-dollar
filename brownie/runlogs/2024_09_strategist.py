
# -------------------------------
# Sep 3, 2024 - Withdraw from 2nd Native Staking Strategy
# -------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(oeth_dripper.collectAndRebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Withdraw 983 WETH from the Second Native Staking Strategy
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_NATIVE_STAKING_2_STRAT, 
        [WETH], 
        [983 * 10**18],
        std
      )
    )

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(oeth_vault_value_checker.checkDelta(profit, (1 * 10**17), vault_change, (1 * 10**17), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)


# -------------------------------------------
# Sept 4 2024 - OETHb allocation & rebalance
# -------------------------------------------
from world_base import *

def main():
  with TemporaryForkForOETHbReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({'from':OETHB_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from':OETHB_STRATEGIST}))

    # Deposit WETH
    txs.append(
      vault_admin.depositToStrategy(
        OETHB_AERODROME_AMO_STRATEGY, 
        [weth], 
        [329 * 10**18], 
        {'from': OETHB_STRATEGIST}
      )
    )

    # deposit funds into the underlying strategy
    txs.append(
      amo_strat.rebalance(
        0, 
        True,
        0,
        {'from': OETHB_STRATEGIST}

      )
    )

    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (500 * 10**18), vault_change, (500 * 10**18), {'from': OETHB_STRATEGIST}))

# -------------------------------
# Sep 5, 2024 - Withdraw from 2nd Native Staking Strategy
# -------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(oeth_dripper.collectAndRebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Withdraw 983 WETH from the Second Native Staking Strategy
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_NATIVE_STAKING_2_STRAT, 
        [WETH], 
        [956 * 10**18],
        std
      )
    )

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(oeth_vault_value_checker.checkDelta(profit, (1 * 10**17), vault_change, (1 * 10**17), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

# -------------------------------
# Sep 6, 2024 - OETHb Harvest
# -------------------------------
from aerodrome_harvest import *
def main():
    txs = []

    amount = 604.1063751091 * 10**18

    # Approve the swap router to move it
    txs.append(
        aero.approve(AERODROME_SWAP_ROUTER_BASE, amount, from_strategist)
    )

    # Do the swap
    txs.append(
        aero_router.exactInputSingle(
            swap_params(amount, OETHB_VAULT_PROXY_ADDRESS),
            from_strategist
        )
    )

    txs.append(
        vault_core.rebase(from_strategist)
    )

    print(to_gnosis_json(txs, OETHB_STRATEGIST, "8453"))


# -------------------------------------------
# Sept 6 2024 - OETHb allocation & rebalance
# -------------------------------------------
from world_base import *

def main():
  with TemporaryForkForOETHbReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({'from':OETHB_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from':OETHB_STRATEGIST}))

    # Deposit WETH
    txs.append(
      vault_admin.depositToStrategy(
        OETHB_AERODROME_AMO_STRATEGY, 
        [weth], 
        [173.99 * 10**18], 
        {'from': OETHB_STRATEGIST}
      )
    )

    # deposit funds into the underlying strategy
    txs.append(
      amo_strat.rebalance(
        0, 
        True,
        0,
        {'from': OETHB_STRATEGIST}

      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_STRATEGIST)[1]
    profit = vault_change - supply_change

    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

    txs.append(vault_value_checker.checkDelta(profit, (500 * 10**18), vault_change, (500 * 10**18), {'from': OETHB_STRATEGIST}))

# -------------------------------
# Sep 7, 2024 - OETHb Harvest
# -------------------------------
from aerodrome_harvest import *
def main():
    txs = []

    amount = 3776.18127928752 * 10**18

    # Collect AERO from the strategy
    txs.append(
        amo_strat.collectRewardTokens(from_strategist)
    )

    # Approve the swap router to move it
    txs.append(
        aero.approve(AERODROME_SWAP_ROUTER_BASE, amount, from_strategist)
    )

    # Do the swap
    txs.append(
        aero_router.exactInputSingle(
            swap_params(amount, OETHB_DRIPPER),
            from_strategist
        )
    )

    # Collect & Rebase (to reset drip rate)
    txs.append(
        dripper.collectAndRebase(from_strategist)
    )

    print(to_gnosis_json(txs, OETHB_STRATEGIST, "8453"))

# -------------------------------
# Sep 10, 2024 - OETHb Harvest
# -------------------------------
from aerodrome_harvest import *
def main():
    txs = []

    amount = 1095.07191359916 * 10**18

    # Collect AERO from the strategy
    txs.append(
        amo_strat.collectRewardTokens(from_strategist)
    )

    # Approve the swap router to move it
    txs.append(
        aero.approve(AERODROME_SWAP_ROUTER_BASE, amount, from_strategist)
    )

    # Do the swap
    txs.append(
        aero_router.exactInputSingle(
            swap_params(amount, OETHB_STRATEGIST),
            from_strategist
        )
    )

    print(to_gnosis_json(txs, OETHB_STRATEGIST, "8453"))

# -------------------------------------
# Sep 11, 2024 - OETH Buyback
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
# Sep 11, 2024 - OUSD Buyback
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

# -------------------------------------------
# Sept 11 2024 - OETHb allocation & rebalance
# -------------------------------------------
from world_base import *

def main():
  with TemporaryForkForOETHbReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({ 'from': OETHB_STRATEGIST }))
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_STRATEGIST }))

    # Deposit all WETH
    txs.append(
      vault_admin.depositToStrategy(
        OETHB_AERODROME_AMO_STRATEGY, 
        [weth], 
        [weth.balanceOf(OETHB_VAULT_PROXY_ADDRESS)], 
        {'from': OETHB_STRATEGIST}
      )
    )

    # deposit funds into the underlying strategy
    txs.append(
      amo_strat.rebalance(
        0, 
        True,
        0,
        {'from': OETHB_STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), {'from': OETHB_STRATEGIST}))

    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

# -------------------------------------------
# Sept 12 2024 - OETHb allocation & rebalance
# -------------------------------------------
from world_base import *

def main():
  with TemporaryForkForOETHbReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({ 'from': OETHB_STRATEGIST }))
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_STRATEGIST }))

    # Deposit all WETH
    wethAmount = weth.balanceOf(OETHB_VAULT_PROXY_ADDRESS)
    txs.append(
      vault_admin.depositToStrategy(
        OETHB_AERODROME_AMO_STRATEGY, 
        [weth], 
        [wethAmount], 
        {'from': OETHB_STRATEGIST}
      )
    )

    # deposit funds into the underlying strategy
    txs.append(
      amo_strat.rebalance(
        0, 
        True,
        0,
        {'from': OETHB_STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), {'from': OETHB_STRATEGIST}))

    print("-----")
    print("WETH", "{:.6f}".format(wethAmount / 10**18), wethAmount)
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

# -------------------------------------------
# Sept 13 2024 - OETHb allocation & rebalance
# -------------------------------------------
from world_base import *

def main():
  with TemporaryForkForOETHbReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({ 'from': OETHB_STRATEGIST }))
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_STRATEGIST }))

    # Deposit all WETH
    wethDepositAmount = weth.balanceOf(OETHB_VAULT_PROXY_ADDRESS)
    txs.append(
      vault_admin.depositToStrategy(
        OETHB_AERODROME_AMO_STRATEGY, 
        [weth], 
        [wethDepositAmount], 
        {'from': OETHB_STRATEGIST}
      )
    )

    # Rebalance the AMO pool
    wethPoolBalance = weth.balanceOf(AERODROME_WETH_OETHB_POOL_BASE)
    superOETHbPoolBalance = oethb.balanceOf(AERODROME_WETH_OETHB_POOL_BASE)
    total = wethPoolBalance + superOETHbPoolBalance
    swapAmount = total * 0.01
    minAmount = swapAmount * 0.98

    txs.append(
      amo_strat.rebalance(
        swapAmount,
        False,
        minAmount,
        {'from': OETHB_STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), {'from': OETHB_STRATEGIST}))

    print("Pool WETH      ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / total)
    print("Pool superOETH ", "{:.6f}".format(superOETHbPoolBalance / 10**18), superOETHbPoolBalance * 100 / total)
    print("Pool Total     ", "{:.6f}".format(total / 10**18), total)
    print("-----")
    print("WETH Deposit", "{:.6f}".format(wethDepositAmount / 10**18), wethDepositAmount)
    print("-----")
    print("Swap amount", "{:.6f}".format(swapAmount / 10**18), swapAmount)
    print("Min  amount", "{:.6f}".format(minAmount / 10**18), minAmount)
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

# -------------------------------------------
# Sept 13 2024 - Withdraw from OETH AMO Strategy
# -------------------------------------------

from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(dripper.collectAndRebase({'from': STRATEGIST}))
    txs.append(oeth_vault_value_checker.takeSnapshot({'from': STRATEGIST}))

    # Remove 50 WETH from strategy and burn equivalent OETH
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [weth], 
        [50 * 10**18],
        {'from': STRATEGIST}
      )
    )

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (0.1 * 10**18), {'from': STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

    # Test the OETH ARM can claim its withdrawals
    txs.append(
      vault_oeth_core.claimWithdrawals(
        [47, 48],
        {'from': OETH_ARM}
      )
    )

# -------------------------------------------
# Sept 13 2024 - OETHb allocation & rebalance
# -------------------------------------------
from world_base import *

def main():
  with TemporaryForkForOETHbReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({ 'from': OETHB_STRATEGIST }))
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_STRATEGIST }))

    # Deposit all WETH
    wethDepositAmount = weth.balanceOf(OETHB_VAULT_PROXY_ADDRESS)
    txs.append(
      vault_admin.depositToStrategy(
        OETHB_AERODROME_AMO_STRATEGY, 
        [weth], 
        [wethDepositAmount], 
        {'from': OETHB_STRATEGIST}
      )
    )


    # Rebalance the AMO pool
    (wethOwned, oethbOwned) = amo_strat.getPositionPrincipal()
    wethPoolBalance = weth.balanceOf(AERODROME_WETH_OETHB_POOL_BASE)
    superOETHbPoolBalance = oethb.balanceOf(AERODROME_WETH_OETHB_POOL_BASE)
    total = wethPoolBalance + superOETHbPoolBalance
    nonStratWeth = wethPoolBalance - wethOwned
    nonStratOethb = superOETHbPoolBalance - oethbOwned
    stratTotal = wethOwned + oethbOwned

    print("Strat WETH      ", "{:.6f}".format(wethOwned / 10**18), wethOwned * 100 / stratTotal)
    print("Strat superOETH ", "{:.6f}".format(oethbOwned / 10**18), oethbOwned * 100 / stratTotal)
    print("Non-Strat WETH      ", "{:.6f}".format(nonStratWeth / 10**18), nonStratWeth)
    print("Non-Strate superOETH ", "{:.6f}".format(nonStratOethb / 10**18), nonStratOethb)
    print("-----")

    print("Pool WETH      ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / total)
    print("Pool superOETH ", "{:.6f}".format(superOETHbPoolBalance / 10**18), superOETHbPoolBalance * 100 / total)
    print("Pool Total     ", "{:.6f}".format(total / 10**18), total)
    print("-----")
    
    swapWeth = True
    swapAmount = 28 * 10**18
    minAmount = swapAmount * 0.98

    print("WETH Deposit", "{:.6f}".format(wethDepositAmount / 10**18), wethDepositAmount)
    print("-----")
    print("Swap amount", "{:.6f}".format(swapAmount / 10**18), swapAmount)
    print("Min  amount", "{:.6f}".format(minAmount / 10**18), minAmount)
    print("-----")

    txs.append(
      amo_strat.rebalance(
        swapAmount,
        swapWeth,
        minAmount,
        {'from': OETHB_STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), {'from': OETHB_STRATEGIST}))

    wethPoolBalance = weth.balanceOf(AERODROME_WETH_OETHB_POOL_BASE)
    superOETHbPoolBalance = oethb.balanceOf(AERODROME_WETH_OETHB_POOL_BASE)
    total = wethPoolBalance + superOETHbPoolBalance

    (wethOwned, oethbOwned) = amo_strat.getPositionPrincipal()
    nonStratWeth = wethPoolBalance - wethOwned
    nonStratOethb = superOETHbPoolBalance - oethbOwned
    stratTotal = wethOwned + oethbOwned

    print("Strat WETH      ", "{:.6f}".format(wethOwned / 10**18), wethOwned * 100 / stratTotal)
    print("Strat superOETH ", "{:.6f}".format(oethbOwned / 10**18), oethbOwned * 100 / stratTotal)
    print("Non-Strat WETH      ", "{:.6f}".format(nonStratWeth / 10**18), nonStratWeth)
    print("Non-Strate superOETH ", "{:.6f}".format(nonStratOethb / 10**18), nonStratOethb)
    print("-----")
    print("Pool WETH      ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / total)
    print("Pool superOETH ", "{:.6f}".format(superOETHbPoolBalance / 10**18), superOETHbPoolBalance * 100 / total)
    print("Pool Total     ", "{:.6f}".format(total / 10**18), total)
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

# -----------------------------------------------------
# Sept 16 2024 - OETHb allocation & rebalance 12:00 CET
# -----------------------------------------------------

from world_base import *

def main():
  with TemporaryForkForOETHbReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({ 'from': OETHB_STRATEGIST }))
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_STRATEGIST }))

    # Deposit all WETH
    wethDepositAmount = weth.balanceOf(OETHB_VAULT_PROXY_ADDRESS)
    txs.append(
      vault_admin.depositToStrategy(
        OETHB_AERODROME_AMO_STRATEGY, 
        [weth], 
        [wethDepositAmount], 
        {'from': OETHB_STRATEGIST}
      )
    )

    amo_snapshot()
    swapWeth = True
    swapAmount = 0
    minAmount = swapAmount * 0.98
    print("--------------------")
    print("WETH Deposit ", c18(wethDepositAmount))
    print("-----")
    print("Swap amount  ", c18(swapAmount))
    print("Min  amount  ", c18(minAmount))
    print("-----")

    txs.append(
      amo_strat.rebalance(
        swapAmount,
        swapWeth,
        minAmount,
        {'from': OETHB_STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), {'from': OETHB_STRATEGIST}))

    amo_snapshot()
    print("--------------------")
    print("Profit       ", c18(profit), profit)
    print("Vault Change ", c18(vault_change), vault_change)


# -----------------------------------------------------
# Sept 17 2024 - OETHb allocation & rebalance
# -----------------------------------------------------
from world_base import *

def main():
  with TemporaryForkForOETHbReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({ 'from': OETHB_STRATEGIST }))
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_STRATEGIST }))

    # Deposit all WETH
    wethDepositAmount = weth.balanceOf(OETHB_VAULT_PROXY_ADDRESS)
    txs.append(
      vault_admin.depositToStrategy(
        OETHB_AERODROME_AMO_STRATEGY, 
        [weth], 
        [wethDepositAmount], 
        {'from': OETHB_STRATEGIST}
      )
    )

    amo_snapshot()
    swapWeth = False
    swapAmount = 3 * 10**18
    minAmount = swapAmount * 0.98
    print("--------------------")
    print("WETH Deposit ", c18(wethDepositAmount))
    print("-----")
    print("Swap amount  ", c18(swapAmount))
    print("Min  amount  ", c18(minAmount))
    print("-----")

    txs.append(
      amo_strat.rebalance(
        swapAmount,
        swapWeth,
        minAmount,
        {'from': OETHB_STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (10 * 10**18), {'from': OETHB_STRATEGIST}))

    amo_snapshot()
    print("--------------------")
    print("Profit       ", c18(profit), profit)
    print("Vault Change ", c18(vault_change), vault_change)

# -----------------------------------------------------
# Sept 18 2024 - OETHb allocation & rebalance 22:50 CET
# -----------------------------------------------------

from world_base import *

def main():
  with TemporaryForkForOETHbReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({ 'from': OETHB_STRATEGIST }))
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_STRATEGIST }))

    # Deposit all WETH
    wethDepositAmount = weth.balanceOf(OETHB_VAULT_PROXY_ADDRESS)
    txs.append(
      vault_admin.depositToStrategy(
        OETHB_AERODROME_AMO_STRATEGY, 
        [weth], 
        [wethDepositAmount], 
        {'from': OETHB_STRATEGIST}
      )
    )

    amo_snapshot()
    swapWeth = True
    swapAmount = 0
    minAmount = swapAmount * 0.98
    print("--------------------")
    print("WETH Deposit ", c18(wethDepositAmount))
    print("-----")
    print("Swap amount  ", c18(swapAmount))
    print("Min  amount  ", c18(minAmount))
    print("-----")

    txs.append(
      amo_strat.rebalance(
        swapAmount,
        swapWeth,
        minAmount,
        {'from': OETHB_STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), {'from': OETHB_STRATEGIST}))

    amo_snapshot()
    print("--------------------")
    print("Profit       ", c18(profit), profit)
    print("Vault Change ", c18(vault_change), vault_change)

# -----------------------------------------------------
# Sept 18 2024 - wOETH Strategy Deposit
# -----------------------------------------------------
from world_base import *

def main():
  txs = []

  treasury_address = "0x3c112E20141B65041C252a68a611EF145f58B7bc"
  amount = 110 * 10**18

  # Update oracle price
  txs.append(woeth_strat.updateWOETHOraclePrice({ 'from': OETHB_STRATEGIST }))
  
  expected_oethb = woeth_strat.getBridgedWOETHValue(amount)

  # Rebase
  txs.append(vault_core.rebase({ 'from': OETHB_STRATEGIST }))

  # Take Vault snapshot 
  txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_STRATEGIST }))

  # Deposit to wOETH strategy
  txs.append(woeth.approve(OETHB_WOETH_STRATEGY, amount, { 'from': OETHB_STRATEGIST }))

  # Deposit to wOETH strategy
  txs.append(woeth_strat.depositBridgedWOETH(amount, { 'from': OETHB_STRATEGIST }))

  # Rebase so that any yields from price update and
  # backing asset change from deposit are accounted for.
  txs.append(vault_core.rebase({ 'from': OETHB_STRATEGIST }))

  # Transfer to treasury
  txs.append(oethb.transfer(treasury_address, expected_oethb, { 'from': OETHB_STRATEGIST }))

  # Check Vault Value against snapshot
  vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_STRATEGIST)[0]
  supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_STRATEGIST)[1]
  profit = vault_change - supply_change

  txs.append(vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (10 * 10**18), {'from': OETHB_STRATEGIST}))

  print("--------------------")
  print("Deposited wOETH     ", c18(amount), amount)
  print("Expected superOETHb ", c18(expected_oethb), expected_oethb)
  print("--------------------")
  print("Profit       ", c18(profit), profit)
  print("Vault Change ", c18(vault_change), vault_change)

  print(to_gnosis_json(txs, OETHB_STRATEGIST, "8453"))


# -----------------------------------------------------
# Sept 19 2024 - wOETH Strategy Deposit
# -----------------------------------------------------
from world_base import *

def main():
  txs = []

  treasury_address = "0x3c112E20141B65041C252a68a611EF145f58B7bc"
  amount = 1224.0743864 * 10**18

  # Update oracle price
  txs.append(woeth_strat.updateWOETHOraclePrice({ 'from': OETHB_STRATEGIST }))
  
  expected_oethb = woeth_strat.getBridgedWOETHValue(amount)

  # Rebase
  txs.append(vault_core.rebase({ 'from': OETHB_STRATEGIST }))

  # Take Vault snapshot 
  txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_STRATEGIST }))

  # Deposit to wOETH strategy
  txs.append(woeth.approve(OETHB_WOETH_STRATEGY, amount, { 'from': OETHB_STRATEGIST }))

  # Deposit to wOETH strategy
  txs.append(woeth_strat.depositBridgedWOETH(amount, { 'from': OETHB_STRATEGIST }))

  # Rebase so that any yields from price update and
  # backing asset change from deposit are accounted for.
  txs.append(vault_core.rebase({ 'from': OETHB_STRATEGIST }))

  # Transfer to treasury
  txs.append(oethb.transfer(treasury_address, expected_oethb, { 'from': OETHB_STRATEGIST }))

  # Check Vault Value against snapshot
  vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_STRATEGIST)[0]
  supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_STRATEGIST)[1]
  profit = vault_change - supply_change

  txs.append(vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (10 * 10**18), {'from': OETHB_STRATEGIST}))

  print("--------------------")
  print("Deposited wOETH     ", c18(amount), amount)
  print("Expected superOETHb ", c18(expected_oethb), expected_oethb)
  print("--------------------")
  print("Profit       ", c18(profit), profit)
  print("Vault Change ", c18(vault_change), vault_change)

  print(to_gnosis_json(txs, OETHB_STRATEGIST, "8453"))

# -------------------------------------------
# Sept 20 2024 - Withdraw from OETH AMO Strategy
# -------------------------------------------

from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(oeth_dripper.collectAndRebase({'from': STRATEGIST}))
    txs.append(oeth_vault_value_checker.takeSnapshot({'from': STRATEGIST}))

    # Remove 50 WETH from strategy and burn equivalent OETH
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [weth], 
        [500 * 10**18],
        {'from': STRATEGIST}
      )
    )

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (0.1 * 10**18), {'from': STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

    # Test the OETH ARM can claim its withdrawal
    # To see all the outstanding withdrawal requests, see Dune query https://dune.com/queries/4067211/6848601
    txs.append(
      vault_oeth_core.claimWithdrawals(
        [58],
        {'from': OETH_ARM}
      )
    )

# -------------------------------------------
# Sept 20 2024 - Add SSV to first Native Staking SSV Cluster
# -------------------------------------------

from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Send 150 SSV to the first Native Staking Strategy
    amount = 150 * 10**18
    txs.append(
      ssv.transfer(
        OETH_NATIVE_STAKING_STRAT, 
        amount,
        {'from': STRATEGIST}
      )
    )

    txs.append(
      native_staking_strat.depositSSV(
        # SSV Operator Ids
        [342, 343, 344, 345], 
        amount,
        # SSV Cluster details:
        # validatorCount, networkFeeIndex, index, active, balance
        [500, 76968331269, 0, True, 108066400915950000100],
        {'from': STRATEGIST}
      )
    )

# -----------------------------------------------------
# Sept 22 2024 - Harvest & Swap
# -----------------------------------------------------
from aerodrome_harvest import *
def main():
    txs = []

    amount = 100000 * 10**18

    # Collect AERO from the strategy
    txs.append(
        amo_strat.collectRewardTokens(from_strategist)
    )

    # Approve the swap router to move it
    txs.append(
        aero.approve(AERODROME_SWAP_ROUTER_BASE, amount, from_strategist)
    )

    # Do the swap
    txs.append(
        aero_router.exactInputSingle(
            swap_params(amount, OETHB_STRATEGIST),
            from_strategist
        )
    )

    print(to_gnosis_json(txs, OETHB_STRATEGIST, "8453"))

# -------------------------------
# Sep 22, 2024 - Withdraw from 2nd Native Staking Strategy
# -------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(oeth_dripper.collectAndRebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Withdraw 570 WETH from the Second Native Staking Strategy
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_NATIVE_STAKING_2_STRAT, 
        [WETH], 
        [570.472805877259861642 * 10**18],
        std
      )
    )

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(oeth_vault_value_checker.checkDelta(profit, (1 * 10**17), vault_change, (1 * 10**17), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)


# -------------------------------------
# Sep 24, 2024 - Reallocate WETH from Second Native Staking Strategy to OETH AMO Strategy
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(oeth_dripper.collectAndRebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Withdraw WETH from the Second Native Staking Strategy
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_NATIVE_STAKING_2_STRAT, 
        [WETH], 
        [375 * 10**18],
        std
      )
    )

    # Deposit WETH to the AMO
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [WETH], 
        [375 * 10**18],
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



# -------------------------------------
# Sep 24, 2024 - Harvest & Pay Treasury
# -------------------------------------
from aerodrome_harvest import *

def main():
  txs = []

  treasury_address = "0x3c112E20141B65041C252a68a611EF145f58B7bc"
  amount = 55555 * 10**18

  # Collect AERO from the strategy
  txs.append(
      amo_strat.collectRewardTokens(from_strategist)
  )

  # Transfer 55,555 AERO to treasury
  txs.append(
    aero.transfer(treasury_address, amount, from_strategist)
  )

  print(to_gnosis_json(txs, OETHB_STRATEGIST, "8453"))


# -------------------------------------
# Sep 24, 2024 - Swap AERO to superOETHb
# -------------------------------------
from aerodrome_harvest import *
from eth_abi.packed import encode_packed
import eth_abi

def main():
  txs = []

  ognSwapAmount = 22222 * 10**18
  oethbSwapAmount = 111111 * 10**18

  # Collect AERO from the strategy
  txs.append(
      amo_strat.collectRewardTokens(from_strategist)
  )

  # Approve the swap router to move it
  txs.append(
      aero.approve(AERODROME_SWAP_ROUTER_BASE, ognSwapAmount + oethbSwapAmount, from_strategist)
  )

  oethb_path = encode_packed(
    ['address', 'int24', 'address', 'int24', 'address'],
    [
      AERO_BASE,
      200, # AERO > WETH tickSpacing
      WETH_BASE,
      1, # WETH > OETHb tickSpacing
      OETHB
    ]
  ).hex()

  # Do the AERO > OETHb swap
  txs.append(
      aero_router.exactInput(
          swap_params_multiple(
            oethbSwapAmount, 
            oethb_path,
            recipient=OETHB_WETH_BRIBE_CONTRACT, 
            to_token=AERO_BASE,
            to_token_label="superOETHb"
          ),
          from_strategist
      )
  )

  # Do the AERO > OETHb swap for OGN swap later
  txs.append(
      aero_router.exactInput(
          swap_params_multiple(
            ognSwapAmount, 
            oethb_path,
            recipient=OETHB_STRATEGIST, 
            to_token=AERO_BASE,
            to_token_label="superOETHb"
          ),
          from_strategist
      )
  )

  print(to_gnosis_json(txs, OETHB_STRATEGIST, "8453"))

# -------------------------------------
# Sep 24, 2024 - Swap uperOETHb to OGN
# -------------------------------------
from aerodrome_harvest import *
from eth_abi.packed import encode_packed
import eth_abi

def main():
  with TemporaryForkForOETHbReallocations() as txs:
    amount = 7724739194962215297

    # Collect AERO from the strategy
    txs.append(
        amo_strat.collectRewardTokens(from_strategist)
    )

    # Approve the router to move it
    txs.append(
        oethb.approve(AERODROME_ROUTER2_BASE, amount, from_strategist)
    )

    minOut = int(215147294464596380425240 * 99 / 100)

    routes = [[
      OETHB, # from
      OGN_BASE, # to
      False, # stable
      "0x420DD381b31aEf6683db6B902084cB0FFECe40Da" # pool factory
    ]]

    # Swap
    txs.append(
      aero_router2.swapExactTokensForTokens(
        amount,
        minOut,
        routes,
        OETHB_STRATEGIST,
        time.time() + (2 * 60 * 60), # deadline
        from_strategist
      )
    )

# -------------------------------------
# Sep 25, 2024 - Bribe with OETHb
# -------------------------------------
from aerodrome_harvest import *

def main():
  with TemporaryForkForOETHbReallocations() as txs:
    amount = 38692983174128797556

    # Approve the bribes contract to move it
    txs.append(
        oethb.approve(OETHB_WETH_BRIBE_CONTRACT, amount, from_strategist)
    )

    # Bribe
    txs.append(
      oethb_weth_bribe.notifyRewardAmount(
        OETHB,
        amount,
        from_strategist
      )
    )

# -------------------------------------
# Sep 25, 2024 - Bribe with AERO
# -------------------------------------
from aerodrome_harvest import *

def main():
  with TemporaryForkForOETHbReallocations() as txs:
    amount = aero.balanceOf(OETHB_STRATEGIST)

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

# -----------------------------------------------------
# Sept 18 2024 - OETHb allocation & rebalance 22:50 CET
# -----------------------------------------------------

from world_base import *

def main():
  with TemporaryForkForOETHbReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({ 'from': OETHB_STRATEGIST }))
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_STRATEGIST }))

    # Deposit all WETH
    wethDepositAmount = weth.balanceOf(OETHB_VAULT_PROXY_ADDRESS)
    txs.append(
      vault_admin.depositToStrategy(
        OETHB_AERODROME_AMO_STRATEGY, 
        [weth], 
        [wethDepositAmount], 
        {'from': OETHB_STRATEGIST}
      )
    )

    amo_snapshot()
    swapWeth = True
    swapAmount = 0
    minAmount = swapAmount * 0.98
    print("--------------------")
    print("WETH Deposit ", c18(wethDepositAmount))
    print("-----")
    print("Swap amount  ", c18(swapAmount))
    print("Min  amount  ", c18(minAmount))
    print("-----")

    txs.append(
      amo_strat.rebalance(
        swapAmount,
        swapWeth,
        minAmount,
        {'from': OETHB_STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), {'from': OETHB_STRATEGIST}))

    amo_snapshot()
    print("--------------------")
    print("Profit       ", c18(profit), profit)
    print("Vault Change ", c18(vault_change), vault_change)


# -------------------------------
# Sep 27, 2024 - OUSD Reallocation 10k USDC from Morpho Aave to new MetaMorpho
# -------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({'from':STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from':STRATEGIST}))

    # Withdraw 10k from Morpho Aave
    txs.append(
      vault_admin.withdrawFromStrategy(
        MORPHO_AAVE_STRAT, 
        [usdc], 
        [10_000 * 10**6], 
        {'from': STRATEGIST}
      )
    )

    # Put everything in new MetaMorpho
    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_META_USDC_STRAT, 
        [usdc], 
        [10_000*10**6], 
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

# -------------------------------
# Sep 27, 2024 - Withdraw from 2nd Native Staking Strategy
# -------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(oeth_dripper.collectAndRebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Withdraw 16 WETH from the Second Native Staking Strategy
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_NATIVE_STAKING_2_STRAT, 
        [WETH], 
        [16 * 10**18],
        std
      )
    )

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(oeth_vault_value_checker.checkDelta(profit, (1 * 10**17), vault_change, (1 * 10**17), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

# -------------------------------------
# Sep 27, 2024 - OETH Buyback
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
# Sep 27, 2024 - OUSD Buyback
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
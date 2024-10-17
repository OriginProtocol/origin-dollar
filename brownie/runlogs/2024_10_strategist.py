# -----------------------------------------------------
# Oct 3rd 2024 - OETHb allocation & rebalance
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
    swapAmount = 1e18
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
# Oct 3rd 2024 - OUSD Reallocation 200k USDC from Morpho Aave to new MetaMorpho
# -----------------------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({'from':STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from':STRATEGIST}))

    # Withdraw 200k from Morpho Aave
    txs.append(
      vault_admin.withdrawFromStrategy(
        MORPHO_AAVE_STRAT, 
        [usdc], 
        [200_000 * 10**6], 
        {'from': STRATEGIST}
      )
    )

    # Put everything in new MetaMorpho
    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_META_USDC_STRAT, 
        [usdc], 
        [200_000*10**6], 
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



# -----------------------------------
# Oct 4, 2024 - OETHb Harvest & Swap
# -----------------------------------
from world_base import *
def main():
    txs = []

    amount = 124406 * 10**18
    min_amount = 58.44 * 10**18
    fee_bps = 2000 # 20%

    # Approve harvester to move AERO
    txs.append(
        aero.approve(OETHB_HARVESTER, amount, from_strategist)
    )

    # Collect AERO from the strategy
    txs.append(
        harvester.harvestAndSwap(amount, min_amount, fee_bps, True, from_strategist)
    )

    # Reset harvester allowance
    txs.append(
        aero.approve(OETHB_HARVESTER, 0, from_strategist)
    )

    print(to_gnosis_json(txs, OETHB_STRATEGIST, "8453"))

# ----------------------------------------------------------
# Oct 5, 2024 - Swap AERO to superOETHb & payback treasury 
# ----------------------------------------------------------
from aerodrome_harvest import *
from eth_abi.packed import encode_packed
import eth_abi

def main():
  txs = []

  oethbSwapAmount = 42000 * 10**18
  treasury_address = "0x3c112E20141B65041C252a68a611EF145f58B7bc"

  # Approve the swap router to move it
  txs.append(
      aero.approve(AERODROME_SWAP_ROUTER_BASE, oethbSwapAmount, from_strategist)
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
            recipient=treasury_address, 
            to_token=AERO_BASE,
            to_token_label="superOETHb"
          ),
          from_strategist
      )
  )

  print(to_gnosis_json(txs, OETHB_STRATEGIST, "8453"))


# -------------------------------
# Oct 8, 2024 - Remove default strategy for WETH and deposit to AMO
# -------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(oeth_dripper.collectAndRebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Remove the second Native Staking Strategy as the default strategy from WETH
    txs.append(
      vault_oeth_admin.setAssetDefaultStrategy(
        WETH,
        "0x0000000000000000000000000000000000000000", 
        std
      )
    )

    # Deposit WETH to the AMO
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [WETH], 
        [900 * 10**18],
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

# -----------------------------------------------------
# Oct 9th 2024 - OETHb allocation & rebalance
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


# ----------------------------------------------------------
# Oct 11, 2024 - Fund dripper and change drip rate
# ----------------------------------------------------------
from world_base import *
def main():
    txs = []

    amount = 79759 * 10**18
    min_amount = 39.5 * 10**18
    fee_bps = 2000 # 20%
    send_to_dripper = True

    # Approve harvester to move AERO
    txs.append(
        aero.approve(OETHB_HARVESTER, amount, from_strategist)
    )

    # Collect AERO from the strategy & swap to get yields
    txs.append(
        harvester.harvestAndSwap(amount, min_amount, fee_bps, send_to_dripper, from_strategist)
    )

    # Change dripper rate
    txs.append(
        dripper.setDripRate(106200624970822, from_strategist)
    )

    # Reset harvester allowance
    txs.append(
        aero.approve(OETHB_HARVESTER, 0, from_strategist)
    )

    print(to_gnosis_json(txs, OETHB_STRATEGIST, "8453"))

# -------------------------------------------
# Oct 16 2024 - Rebalance and Withdraw from OETH AMO Strategy
# -------------------------------------------

from world import *

def main():
  with TemporaryForkForReallocations() as txs:


    # Before
    txs.append(vault_core.rebase({ 'from': OETHB_STRATEGIST }))
    txs.append(oeth_vault_value_checker.takeSnapshot({'from': STRATEGIST}))

    # AMO pool before
    ethPoolBalance = oeth_metapool.balance()
    oethPoolBalance = oeth.balanceOf(OETH_METAPOOL)
    totalPool = ethPoolBalance + oethPoolBalance
    eth_out_before = oeth_metapool.get_dy(1, 0, 10 * 10**18)

    print("Curve OETH/ETH Pool before")  
    print("Pool ETH      ", "{:.6f}".format(ethPoolBalance / 10**18), ethPoolBalance * 100 / totalPool)
    print("Pool OETH ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total     ", "{:.6f}".format(totalPool / 10**18), totalPool)

    # remove the 10k OETH to increase the price of OETH in the OETH/ETH Curve pool
    metapool_virtual_price = 1001921431201396942
    lp_amount = 1100 * 10**18 * 10**18 / metapool_virtual_price
    txs.append(
        oeth_meta_strat.removeAndBurnOTokens(
        lp_amount, 
        std
        )
    )

    # Remove WETH from strategy and burn equivalent OETH
    txs.append(
      vault_oeth_admin.withdrawFromStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [weth], 
        [310 * 10**18],
        {'from': STRATEGIST}
      )
    )

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (0.1 * 10**18), {'from': STRATEGIST}))
    print("-----")
    snap_value = oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    snap_supply = oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    print("Snap value ", "{:.6f}".format(snap_value / 10**18), snap_value)
    print("Snap supply", "{:.6f}".format(snap_supply / 10**18), snap_supply)
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")


    # AMO pool after
    ethPoolBalance = oeth_metapool.balance()
    oethPoolBalance = oeth.balanceOf(OETH_METAPOOL)
    totalPool = ethPoolBalance + oethPoolBalance
    eth_out_after = oeth_metapool.get_dy(1, 0, 10 * 10**18)

    print("Curve OETH/ETH Pool after")  
    print("Pool ETH      ", "{:.6f}".format(ethPoolBalance / 10**18), ethPoolBalance * 100 / totalPool)
    print("Pool OETH ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total     ", "{:.6f}".format(totalPool / 10**18), totalPool)

    print("-----")
    print("Burn LP amount",  "{:.6f}".format(lp_amount / 10**18), lp_amount)
    print("Sell 10 OETH Curve prices before and after", "{:.6f}".format(eth_out_before / 10**18), "{:.6f}".format(eth_out_after / 10**18))

    # Test the OETH ARM can claim its withdrawals
    txs.append(
      vault_oeth_core.claimWithdrawals(
        [76, 77],
        {'from': OETH_ARM}
      )
    )

# -----------------------------------------------------
# Oct 17th 2024 - OUSD Reallocation 2.483m USDC from Morpho Aave to new MetaMorpho
# -----------------------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_core.rebase({'from':STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from':STRATEGIST}))

    # Withdraw 200k from Morpho Aave
    txs.append(
      vault_admin.withdrawFromStrategy(
        MORPHO_AAVE_STRAT, 
        [usdc], 
        [2_483_000 * 10**6], 
        {'from': STRATEGIST}
      )
    )

    # Put everything in new MetaMorpho
    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_META_USDC_STRAT, 
        [usdc], 
        [2_483_000*10**6], 
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

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

    amo_snapsnot()
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

    amo_snapsnot()
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


# ----------------------------------------------------------
# Oct 7, 2024 - Compensation Claims Shutdown
# ----------------------------------------------------------

from world import *
compensation_claims = Contract.from_explorer('0x9C94df9d594BA1eb94430C006c269C314B1A8281')

with TemporaryFork():
  tx1 = compensation_claims.collect(ousd, {'from': TIMELOCK})
  tx1.sig_string = "collect(address)"
  tx2 = ousd.transfer('0x806CAFaA1B34C9b9d2fC33BBAe3DE209E9D137E0', 1155813200310749364224, {'from': TIMELOCK})
  tx2.sig_string = "transfer(address,uint256)"
  tx3 = ousd.transfer('0x6E3fddab68Bf1EBaf9daCF9F7907c7Bc0951D1dc', 20151176137921749424057, {'from': TIMELOCK})
  tx3.sig_string = "transfer(address,uint256)"
  txs = [tx1, tx2, tx3]

description = """Close out OUSD claims 

In 2020, during the a pre-audit beta of OUSD, the contract was hacked. This has been the only loss of user funds in Origin's history. The Origin team created two  compensation contracts and funded them with team funds to make OUSD users whole. Both compensation contracts had time limited claims periods.

The contract holding the OUSD portion of the claims handed out almost all claims before the deadline, with only 21,306 OUSD remaining on the contract. However, those remaining funds on the OUSD claims contract had never been collected back to an Origin team wallet, and have instead sat on the claims contract for the past several years.

This proposal:

1. Collects all OUSD remaining on the claims contract
2. Sends the user 0x806CAFaA1B34C9b9d2fC33BBAe3DE209E9D137E0 the 1,155 OUSD that the claims contract had on that account, as thanks for bringing these funds to our attention.
3. Transfers the remaining 20,151 OUSD to a team wallet.
"""
with TemporaryFork():
  proposal_id =create_gov_proposal(description, txs)

  print("---")
  print("Compensation:", ousd.balanceOf('0x9C94df9d594BA1eb94430C006c269C314B1A8281')/1e18)
  print("User:",ousd.balanceOf('0x806CAFaA1B34C9b9d2fC33BBAe3DE209E9D137E0')/1e18)
  print("Team:",ousd.balanceOf('0x6E3fddab68Bf1EBaf9daCF9F7907c7Bc0951D1dc')/1e18)
  sim_execute_governor_six(proposal_id)
  print("---")
  print("Compensation:", ousd.balanceOf('0x9C94df9d594BA1eb94430C006c269C314B1A8281')/1e18)
  print("User:",ousd.balanceOf('0x806CAFaA1B34C9b9d2fC33BBAe3DE209E9D137E0')/1e18)
  print("Team:",ousd.balanceOf('0x6E3fddab68Bf1EBaf9daCF9F7907c7Bc0951D1dc')/1e18)
  print("---")

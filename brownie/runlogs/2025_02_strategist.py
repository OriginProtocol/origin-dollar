# -------------------------------------
# Feb 3, 2025 - Remove from wOETH strategy
# -------------------------------------
from aerodrome_harvest import *
from brownie import accounts
import eth_abi
def main():
  with TemporaryForkForReallocations() as txs:
    strategist = accounts.at(MULTICHAIN_STRATEGIST, force=True)
    gas_buffer = 0.03 * 10**18
    eth_amount = strategist.balance() - gas_buffer

    existing_oethb_amount = 322091947000000000000

    # Update oracle price
    txs.append(woeth_strat.updateWOETHOraclePrice({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Rebase
    txs.append(vault_core.rebase({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Take Vault snapshot 
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Mint OETHb with WETH
    txs.append(zapper.deposit({'from': MULTICHAIN_STRATEGIST, 'value': eth_amount}))

    woeth_amount_before = woeth.balanceOf(OETHB_MULTICHAIN_STRATEGIST)

    # Approve wOETH to wOETH strategy (one-time)
    txs.append(oethb.approve(woeth_strat.address, "115792089237316195423570985008687907853269984665640564039457584007913129639935", { 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Withdraw from wOETH strategy
    txs.append(woeth_strat.withdrawBridgedWOETH(eth_amount + existing_oethb_amount, { 'from': OETHB_MULTICHAIN_STRATEGIST }))

    woeth_amount = woeth.balanceOf(OETHB_MULTICHAIN_STRATEGIST) - woeth_amount_before

    # Check Vault Value against snapshot
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_MULTICHAIN_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_MULTICHAIN_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (1 * 10**18), {'from': OETHB_MULTICHAIN_STRATEGIST}))

    print(to_gnosis_json(txs, OETHB_MULTICHAIN_STRATEGIST, "8453"))

    print("--------------------")
    print("Minted superOETHb ", c18(eth_amount), eth_amount)
    print("Redeemed superOETHb ", c18(eth_amount + existing_oethb_amount), eth_amount + existing_oethb_amount)
    print("Withdrawn wOETH     ", c18(woeth_amount), woeth_amount)
    print("--------------------")
    print("Profit       ", c18(profit), profit)
    print("Vault Change ", c18(vault_change), vault_change)

    # Bridge wOETH to Ethereum using CCIP
    txs.append(woeth.approve(BASE_CCIP_ROUTER, woeth_amount, { 'from': OETHB_MULTICHAIN_STRATEGIST }))

    eth_chain_selector = 5009297550715157269

    ccip_message = [
      eth_abi.encode(['address'], [MULTICHAIN_STRATEGIST]),
      '0x',
      [(BRIDGED_WOETH_BASE, woeth_amount)],
      ADDR_ZERO,
      '0x97a657c9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
    ]

    ccip_fee = ccip_router.getFee(eth_chain_selector, ccip_message)

    print("CCIP fee", c18(ccip_fee), ccip_fee)

    txs.append(ccip_router.ccipSend(
      eth_chain_selector,
      ccip_message,
      {'from': OETHB_MULTICHAIN_STRATEGIST, 'value': ccip_fee}
    ))


# -------------------------------------
# Feb 3, 2025 - Unwrap wOETH to OETH
# -------------------------------------
from world import *
def main():
  with TemporaryForkForReallocations() as txs:
    # Unwrap wOETH to OETH
    woeth_amount = woeth.balanceOf(MULTICHAIN_STRATEGIST)

    oeth_amount_before = oeth.balanceOf(MULTICHAIN_STRATEGIST)
    txs.append(
      woeth.redeem(woeth_amount, MULTICHAIN_STRATEGIST, MULTICHAIN_STRATEGIST, {'from': MULTICHAIN_STRATEGIST})
    )

    oeth_amount_to_redeem = oeth.balanceOf(MULTICHAIN_STRATEGIST) - oeth_amount_before

    # Redeem OETH to WETH
    txs.append(
      oeth_vault_core.requestWithdrawal(
        oeth_amount_to_redeem,
        {'from': MULTICHAIN_STRATEGIST}
      )
    )

# -------------------------------------
# Feb 3, 2025 - Claim WETH and bridge to Base
# -------------------------------------
from world import *
from brownie import accounts
import brownie
def main():
  with TemporaryForkForReallocations() as txs:
    requestId = 187

    # Hack to make weth.withdraw work
    brownie.network.web3.provider.make_request('hardhat_setCode', [MULTICHAIN_STRATEGIST, '0x'])

    weth_before = weth.balanceOf(MULTICHAIN_STRATEGIST)
    # Claim withdrawal
    txs.append(oeth_vault_core.claimWithdrawal(requestId, {'from': MULTICHAIN_STRATEGIST}))
    
    weth_received = weth.balanceOf(MULTICHAIN_STRATEGIST) - weth_before

    print("--------------")
    print("WETH Received", c18(weth_received), weth_received)
    print("--------------")

    # Unwrap WETH
    txs.append(
      weth.withdraw(weth_received, {'from': MULTICHAIN_STRATEGIST})
    )
    
    # hex-encoded string for "originprotocol"
    extra_data = "0x6f726967696e70726f746f636f6c"

    # Bridge it
    txs.append(
      superbridge.bridgeETHTo(
        MULTICHAIN_STRATEGIST,
        200000, # minGasLimit
        extra_data, # extraData
        {'value': weth_received, 'from': MULTICHAIN_STRATEGIST}
      )
    )

# -------------------------------------
# Feb 5, 2025 - Remove from wOETH strategy
# -------------------------------------
from aerodrome_harvest import *
from brownie import accounts
import eth_abi
def main():
  with TemporaryForkForReallocations() as txs:
    strategist = accounts.at(MULTICHAIN_STRATEGIST, force=True)
    gas_buffer = 0.03 * 10**18
    eth_amount = strategist.balance() - gas_buffer

    existing_oethb_amount = 0

    # Update oracle price
    txs.append(woeth_strat.updateWOETHOraclePrice({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Rebase
    txs.append(vault_core.rebase({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Take Vault snapshot 
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Mint OETHb with WETH
    txs.append(zapper.deposit({'from': MULTICHAIN_STRATEGIST, 'value': eth_amount}))

    woeth_amount_before = woeth.balanceOf(OETHB_MULTICHAIN_STRATEGIST)

    # # Approve wOETH to wOETH strategy (one-time)
    # txs.append(oethb.approve(woeth_strat.address, "115792089237316195423570985008687907853269984665640564039457584007913129639935", { 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Withdraw from wOETH strategy
    txs.append(woeth_strat.withdrawBridgedWOETH(eth_amount + existing_oethb_amount, { 'from': OETHB_MULTICHAIN_STRATEGIST }))

    woeth_amount = woeth.balanceOf(OETHB_MULTICHAIN_STRATEGIST) - woeth_amount_before

    # Check Vault Value against snapshot
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_MULTICHAIN_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_MULTICHAIN_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (0.3 * 10**18), vault_change, (1 * 10**18), {'from': OETHB_MULTICHAIN_STRATEGIST}))

    print(to_gnosis_json(txs, OETHB_MULTICHAIN_STRATEGIST, "8453"))

    print("--------------------")
    print("Minted superOETHb    ", c18(eth_amount), eth_amount)
    print("Redeemed superOETHb  ", c18(eth_amount + existing_oethb_amount), eth_amount + existing_oethb_amount)
    print("Withdrawn wOETH      ", c18(woeth_amount), woeth_amount)
    print("--------------------")
    print("Profit               ", c18(profit), profit)
    print("Vault Change         ", c18(vault_change), vault_change)
    print("--------------------")

    # Bridge wOETH to Ethereum using CCIP
    txs.append(woeth.approve(BASE_CCIP_ROUTER, woeth_amount, { 'from': OETHB_MULTICHAIN_STRATEGIST }))

    eth_chain_selector = 5009297550715157269

    ccip_message = [
      eth_abi.encode(['address'], [MULTICHAIN_STRATEGIST]),
      '0x',
      [(BRIDGED_WOETH_BASE, woeth_amount)],
      ADDR_ZERO,
      '0x97a657c9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
    ]

    ccip_fee = ccip_router.getFee(eth_chain_selector, ccip_message)
    print("--------------------")
    print("CCIP fee             ", c18(ccip_fee), ccip_fee)
    ccip_fee = int(ccip_fee * 1.2)
    print("Premium              ", c18(0), pcts(20))
    print("Net fee              ", c18(ccip_fee), ccip_fee)
    print("--------------------")

    txs.append(ccip_router.ccipSend(
      eth_chain_selector,
      ccip_message,
      {'from': OETHB_MULTICHAIN_STRATEGIST, 'value': ccip_fee}
    ))


# -------------------------------------
# Feb 13, 2025 - Base deposit 10 WETH to the new Curve AMO strategy
# -------------------------------------
from aerodrome_harvest import *
from brownie import accounts
import eth_abi
def main():
  with TemporaryForkForReallocations() as txs:
    # Rebase
    txs.append(vault_core.rebase({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Take Vault snapshot 
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Deposit 10 WETH to the new Curve AMO strategy
    txs.append(
      vault_admin.depositToStrategy(
        OETHB_CURVE_AMO_STRATEGY, 
        [weth],
        [10 * 10**18],
        {'from': OETHB_MULTICHAIN_STRATEGIST}
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_MULTICHAIN_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_MULTICHAIN_STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), {'from': OETHB_MULTICHAIN_STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("SuperOETH supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

# -------------------------------------
# Feb 14, 2024 - Deposit 1k WETH to Curve AMO
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Deposit WETH to Curve AMO
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [WETH],
        [4400 * 10**18],
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
# Feb 14, 2025 - Base deposit 10 WETH to the new Curve AMO strategy
# -------------------------------------
from aerodrome_harvest import *
from brownie import accounts
import eth_abi
def main():
  with TemporaryForkForReallocations() as txs:
    # Rebase
    txs.append(vault_core.rebase({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Take Vault snapshot 
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Withdraw 1009 WETH from the new Aerodrome AMO strategy
    txs.append(
      vault_admin.withdrawFromStrategy(
        OETHB_AERODROME_AMO_STRATEGY, 
        [weth],
        [1009 * 10**18],
        {'from': OETHB_MULTICHAIN_STRATEGIST}
      )
    )

    amo_snapshot()
    swapWeth = True
    swapAmount = 0
    minAmount = swapAmount * 0.98
    print("-----")
    print("Swap amount  ", c18(swapAmount))
    print("Min  amount  ", c18(minAmount))
    print("-----")

    txs.append(
      amo_strat.rebalance(
        swapAmount,
        swapWeth,
        minAmount,
        {'from': OETHB_MULTICHAIN_STRATEGIST}
      )
    )


    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_MULTICHAIN_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_MULTICHAIN_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), {'from': OETHB_MULTICHAIN_STRATEGIST}))

    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("SuperOETH supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

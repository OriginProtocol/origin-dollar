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

  
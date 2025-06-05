
# -------------------------------------
# June 5, 2025 - Bridge wOETH to Base using CCIP
# -------------------------------------
from world import *
import eth_abi

def main():
  with TemporaryForkForReallocations() as txs:
    amount = woeth.balanceOf(MULTICHAIN_STRATEGIST)

    txs.append(
      woeth.approve(CCIP_ROUTER, amount, std)
    )

    BASE_CHAIN_SELECTOR = 15971525489660198786

    ccip_message = [
          eth_abi.encode(['address'], [OETHB_MULTICHAIN_STRATEGIST]),
          '0x',
          [(WOETH, amount)],
          ADDR_ZERO,
          '0x97a657c900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
        ]
    ccip_fee = ccip_router.getFee(BASE_CHAIN_SELECTOR, ccip_message)
    ccip_fee = ccip_fee * 11 / 10  # Add 10% buffer

    print("CCIP fee     ", ccip_fee)

    txs.append(
      ccip_router.ccipSend(
        BASE_CHAIN_SELECTOR,
        ccip_message,
        { 'value': ccip_fee, 'from': MULTICHAIN_STRATEGIST }
      )
    )


# -----------------------------------------------------
# June 5, 2025 - wOETH Strategy Deposit
# -----------------------------------------------------
from aerodrome_harvest import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Hack to make weth.withdraw work
    brownie.network.web3.provider.make_request('hardhat_setCode', [OETHB_MULTICHAIN_STRATEGIST, '0x'])

    woeth_amount = woeth.balanceOf(OETHB_MULTICHAIN_STRATEGIST)

    # Update oracle price
    txs.append(woeth_strat.updateWOETHOraclePrice({ 'from': OETHB_MULTICHAIN_STRATEGIST }))
    
    expected_oethb = woeth_strat.getBridgedWOETHValue(woeth_amount)

    # Rebase
    txs.append(vault_core.rebase({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Take Vault snapshot 
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Deposit to wOETH strategy
    txs.append(woeth_strat.depositBridgedWOETH(woeth_amount, { 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Redeem the superOETHb for WETH
    txs.append(vault_core.redeem(expected_oethb, expected_oethb, { 'from': MULTICHAIN_STRATEGIST }))

    # Deposit left over WETH to the Curve AMO
    txs.append(
        vault_admin.depositToStrategy(
        OETHB_CURVE_AMO_STRATEGY, 
        [weth],
        [230 * 10**18],
        {'from': OETHB_MULTICHAIN_STRATEGIST}
        )
    )

    # Rebase so that any yields from price update and
    # backing asset change from deposit are accounted for.
    txs.append(vault_core.rebase({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Check Vault Value against snapshot
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_MULTICHAIN_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_MULTICHAIN_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (1 * 10**18), {'from': OETHB_MULTICHAIN_STRATEGIST}))

    print("--------------------")
    print("Deposited wOETH     ", c18(woeth_amount), woeth_amount)
    print("Expected superOETHb ", c18(expected_oethb), expected_oethb)
    print("--------------------")
    print("Profit       ", c18(profit), profit)
    print("Vault Change ", c18(vault_change), vault_change)


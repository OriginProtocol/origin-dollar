# -------------------------------------
# January 5, 2026 - Reallocate remaining USDC in Gauntlet Prime Strategy to Morpho OUSD v2 Strategy
# -------------------------------------

from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_core.rebase(std))
    txs.append(vault_value_checker.takeSnapshot(std))

    # Withdraw all USDC from old Gauntlet Prime Strategy
    txs.append(
      vault_admin.withdrawAllFromStrategy(
        MORPHO_GAUNTLET_PRIME_USDC_STRAT,
        {'from': STRATEGIST}
      )
    )

    # Deposit 1.4m USDC to new Morpho OUSD v2 Strategy
    txs.append(
      vault_admin.depositToStrategy(
        MORPHO_OUSD_V2_STRAT,
        [USDC],
        [1400000 * 10**6],
        std
      )
    )

    # Set Morpho OUSD v2 Strategy as default for USDC
    txs.append(
      vault_admin.setAssetDefaultStrategy(
        USDC,
        MORPHO_OUSD_V2_STRAT,
        std
      )
    )

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), std))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OUSD supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")


########################################################
# Swap OETH to WETH using Curve Pool and Bridge to Base
########################################################

from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Hack to make weth.withdraw work
    brownie.network.web3.provider.make_request('hardhat_setCode', [MULTICHAIN_STRATEGIST, '0x'])

    # Swap OETH to WETH
    oeth_balance = oeth.balanceOf(MULTICHAIN_STRATEGIST)
    weth_balance = weth.balanceOf(MULTICHAIN_STRATEGIST)
    min_weth = int(oeth_balance * 995 / 1000)
    print("Min WETH expected", c18(min_weth), min_weth)
    txs.append(oeth.approve(OETH_CURVE_POOL, oeth_balance, {'from': MULTICHAIN_STRATEGIST}))
    txs.append(oeth_curve_pool.exchange(0, 1, oeth_balance, min_weth, MULTICHAIN_STRATEGIST, {"from": MULTICHAIN_STRATEGIST}))
    oeth_balance = oeth.balanceOf(MULTICHAIN_STRATEGIST) - oeth_balance
    weth_balance = weth.balanceOf(MULTICHAIN_STRATEGIST) - weth_balance
    print("OETH change", c18(-oeth_balance), -oeth_balance)
    print("WETH change", c18(weth_balance), weth_balance)

    txs.append(weth.withdraw(weth_balance, {'from': MULTICHAIN_STRATEGIST}))

    txs.append(
      superbridge.bridgeETHTo(
        MULTICHAIN_STRATEGIST,
        200000,
        '0x6f726967696e70726f746f636f6c',
        {'value': weth_balance, 'from': MULTICHAIN_STRATEGIST}
      )
    )

########################################################
# Mint OETHb with WETH and Bridge to Base
########################################################
from world_base import *
def main():
  with TemporaryForkForReallocations() as txs:
    txs.append(woeth_strat.updateWOETHOraclePrice({ 'from': MULTICHAIN_STRATEGIST }))
    txs.append(vault_core.rebase({'from': MULTICHAIN_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from': MULTICHAIN_STRATEGIST}))

    # Current ETH balance, leaving 0.005 as buffer for fees
    eth_balance = base_strategist.balance() - (0.005 * 10**18)
    # Amount that was borrowed from perf fees
    borrowed_from_guardian = 115 * 10**18
    # Amount to payback to guardian
    payback_amount = 0
    current_guardian_balance = oethb.balanceOf(MULTICHAIN_STRATEGIST)
    original_guardian_balance = current_guardian_balance + borrowed_from_guardian
    print("ETH balance", c18(eth_balance), eth_balance)
    print("Current guardian balance", c18(current_guardian_balance), current_guardian_balance)
    print("Original guardian balance", c18(original_guardian_balance), original_guardian_balance)
    print("OETHb borrowed from guardian", c18(borrowed_from_guardian), borrowed_from_guardian)
    print("Payback amount", c18(payback_amount), payback_amount)

    # Mint OETHb with WETH
    txs.append(zapper.deposit({'from': MULTICHAIN_STRATEGIST, 'value': eth_balance}))

    oethb_amount = oethb.balanceOf(MULTICHAIN_STRATEGIST) - current_guardian_balance - payback_amount
    woeth_balance = woeth.balanceOf(MULTICHAIN_STRATEGIST)

    txs.append(oethb.approve(woeth_strat.address, oethb_amount, {'from': MULTICHAIN_STRATEGIST}))

    txs.append(
      woeth_strat.withdrawBridgedWOETH(oethb_amount, {'from': MULTICHAIN_STRATEGIST})
    )

    woeth_received = woeth.balanceOf(MULTICHAIN_STRATEGIST) - woeth_balance

    print("OETHb burned", c18(oethb_amount), oethb_amount)
    # print("Perf fees", c18(original_guardian_balance), original_guardian_balance)
    print("wOETH Received", c18(woeth_received), woeth_received)

    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (1 * 10**18), {'from': MULTICHAIN_STRATEGIST}))

    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OETHb supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

    txs.append(base_bridge_helper_module.bridgeWOETHToEthereum(woeth_received, {'from': MULTICHAIN_STRATEGIST}))

########################################################
# Request withdrawal of WETH
########################################################
from world import *
def main(): 
  with TemporaryForkForReallocations() as txs:
    # Hack to make weth.withdraw work
    brownie.network.web3.provider.make_request('hardhat_setCode', [MULTICHAIN_STRATEGIST, '0x'])

    woeth_balance = woeth.balanceOf(MULTICHAIN_STRATEGIST)

    oeth_balance = oeth.balanceOf(MULTICHAIN_STRATEGIST)
    print("OETH balance before", c18(oeth_balance), oeth_balance)

    txs.append(woeth.redeem(woeth_balance, MULTICHAIN_STRATEGIST, MULTICHAIN_STRATEGIST, {'from': MULTICHAIN_STRATEGIST}))
    
    oeth_balance = oeth.balanceOf(MULTICHAIN_STRATEGIST) - oeth_balance
    print("OETH unwrapped", c18(oeth_balance), oeth_balance)

    txs.append(oeth_vault_core.requestWithdrawal(oeth_balance, {'from': MULTICHAIN_STRATEGIST}))


########################################################
# Claim withdrawal of WETH and bridge to Base
########################################################
from world import *
def main(): 
  with TemporaryForkForReallocations() as txs:
    # Hack to make weth.withdraw work
    brownie.network.web3.provider.make_request('hardhat_setCode', [MULTICHAIN_STRATEGIST, '0x'])

    withdrawal_request_id = 613

    weth_balance = weth.balanceOf(MULTICHAIN_STRATEGIST)
    print("WETH balance before", c18(weth_balance), weth_balance)
    txs.append(oeth_vault_core.claimWithdrawal(withdrawal_request_id, {'from': MULTICHAIN_STRATEGIST}))
    weth_balance = weth.balanceOf(MULTICHAIN_STRATEGIST) - weth_balance
    print("WETH balance after", c18(weth_balance), weth_balance)

    txs.append(weth.withdraw(weth_balance, {'from': MULTICHAIN_STRATEGIST}))

    txs.append(
      superbridge.bridgeETHTo(
        MULTICHAIN_STRATEGIST,
        200000,
        '0x6f726967696e70726f746f636f6c',
        {'value': weth_balance, 'from': MULTICHAIN_STRATEGIST}
      )
    )

########################################################
# Deposit WETH and Redeem wOETH
########################################################
from world_base import *
def main():
  with TemporaryForkForReallocations() as txs:
    txs.append(woeth_strat.updateWOETHOraclePrice({ 'from': MULTICHAIN_STRATEGIST }))
    txs.append(vault_core.rebase({'from': MULTICHAIN_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from': MULTICHAIN_STRATEGIST}))

    eth_balance = base_strategist.balance() - (0.005 * 10**18)
    borrowed_from_guardian = 373_624625 * 10**12

    current_guardian_balance = oethb.balanceOf(MULTICHAIN_STRATEGIST)
    original_guardian_balance = current_guardian_balance + borrowed_from_guardian
    print("ETH balance", c18(eth_balance), eth_balance)
    print("Current guardian balance", c18(current_guardian_balance), current_guardian_balance)
    print("Original guardian balance", c18(original_guardian_balance), original_guardian_balance)
    print("OETHb borrowed from guardian", c18(borrowed_from_guardian), borrowed_from_guardian)
    
    txs.append(weth.deposit({'from': MULTICHAIN_STRATEGIST, 'value': eth_balance}))
    txs.append(base_bridge_helper_module.depositWETHAndBridgeWOETH(eth_balance, {'from': MULTICHAIN_STRATEGIST}))

    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (1 * 10**18), {'from': MULTICHAIN_STRATEGIST}))

    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OETHb supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

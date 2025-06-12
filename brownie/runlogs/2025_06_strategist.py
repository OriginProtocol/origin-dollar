
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


# -------------------------------------
# June 5, 2025 - Deposit 10 WETH to new OETH Curve AMO
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:

    amount = 1002.66 * 10**18

    txs.append(
        weth.approve(OETH_VAULT, amount, std)
    )

    # Mint OETH with WETH, 1:1
    txs.append(
        oeth_vault_core.mint(WETH, amount, amount, std)
    )

    txs.append(
        woeth.deposit(amount, MULTICHAIN_STRATEGIST, std)
    )

    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # AMO pool before
    wethPoolBalance = weth.balanceOf(OETH_CURVE_POOL)
    oethPoolBalance = oeth.balanceOf(OETH_CURVE_POOL)
    totalPool = wethPoolBalance + oethPoolBalance
    weth_out_before = oeth_curve_pool.get_dy(1, 0, 10**18)

    print("Curve OETH/WETH Pool before")  
    print("Pool WETH  ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)


    # Deposit 1k WETH to Curve AMO
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_CURVE_AMO_STRAT, 
        [WETH],
        [1000 * 10**18],
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


    # AMO pool after
    wethPoolBalance = weth.balanceOf(OETH_CURVE_POOL)
    oethPoolBalance = oeth.balanceOf(OETH_CURVE_POOL)
    totalPool = wethPoolBalance + oethPoolBalance
    weth_out_after = oeth_curve_pool.get_dy(1, 0, 10**18)

    print("Curve OETH/ETH Pool after")  
    print("Pool WETH  ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)
    print("Sell 10 OETH Curve prices before and after", "{:.6f}".format(weth_out_before / 10**18), "{:.6f}".format(weth_out_after / 10**18))

# -------------------------------------
# June 11, 2025 - Withdraw all from new Curve AMO and deposit to old Convex AMO
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # AMO pool before
    wethPoolBalance = weth.balanceOf(OETH_CURVE_POOL)
    oethPoolBalance = oeth.balanceOf(OETH_CURVE_POOL)
    totalPool = wethPoolBalance + oethPoolBalance
    weth_out_before = oeth_curve_pool.get_dy(1, 0, 10**18)

    print("Curve OETH/WETH Pool before")  
    print("Pool WETH  ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)

    # Withdraw WETH from new Curve AMO
    txs.append(
      vault_oeth_admin.withdrawAllFromStrategy(
        OETH_CURVE_AMO_STRAT,
        {'from': STRATEGIST}
      )
    )

    wethVaultBalance = weth.balanceOf(VAULT_OETH_PROXY_ADDRESS)
    wethVaultBalance = wethVaultBalance - 3 * 10**18
    print("WETH to deposit to Convex AMO", "{:.6f}".format(wethVaultBalance / 10**18), wethVaultBalance)

    # Deposit WETH to old Convex AMO
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [weth],
        [wethVaultBalance],
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

    # AMO pool after
    wethPoolBalance = weth.balanceOf(OETH_CURVE_POOL)
    oethPoolBalance = oeth.balanceOf(OETH_CURVE_POOL)
    totalPool = wethPoolBalance + oethPoolBalance
    weth_out_after = oeth_curve_pool.get_dy(1, 0, 10**18)

    print("Curve OETH/ETH Pool after")  
    print("Pool WETH  ", "{:.6f}".format(wethPoolBalance / 10**18), wethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)
    print("Sell 10 OETH Curve prices before and after", "{:.6f}".format(weth_out_before / 10**18), "{:.6f}".format(weth_out_after / 10**18))


# -----------------------------------------------------
# June 12, 2025 - Base deposit wOETH to Bridging Strategy and redeem superOETHb
# -----------------------------------------------------
from aerodrome_harvest import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Hack to make weth.withdraw work
    brownie.network.web3.provider.make_request('hardhat_setCode', [OETHB_MULTICHAIN_STRATEGIST, '0x'])

    woeth_amount = woeth.balanceOf(OETHB_MULTICHAIN_STRATEGIST)

    # Update oracle price
    txs.append(woeth_strat.updateWOETHOraclePrice({ 'from': OETHB_MULTICHAIN_STRATEGIST }))
    
    # expected_oethb = woeth_strat.getBridgedWOETHValue(woeth_amount)

    # Rebase
    txs.append(vault_core.rebase({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Take Vault snapshot 
    txs.append(vault_value_checker.takeSnapshot({ 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Deposit to wOETH strategy
    txs.append(woeth_strat.depositBridgedWOETH(woeth_amount, { 'from': OETHB_MULTICHAIN_STRATEGIST }))

    # Get the amount of superOETHb now in the multisig
    oethb_amount = oethb.balanceOf(OETHB_MULTICHAIN_STRATEGIST)

    # Redeem the superOETHb for WETH
    txs.append(vault_core.redeem(oethb_amount, oethb_amount, { 'from': MULTICHAIN_STRATEGIST }))

    # Unwrap WETH to ETH so it can be bridged to Ethereum
    txs.append(
        weth.withdraw(oethb_amount, {'from': OETHB_MULTICHAIN_STRATEGIST})
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
    print("Redeemed superOETHb ", c18(oethb_amount), oethb_amount)
    print("--------------------")
    print("Profit       ", c18(profit), profit)
    print("Vault Change ", c18(vault_change), vault_change)

# -------------------------------------
# June 12, 2025 - Mint OETH, deposit wOETH and bridge wOETH to Base using CCIP
# -------------------------------------
from world import *
import eth_abi

def main():
  with TemporaryForkForReallocations() as txs:
    oeth_amount = 858 * 10**18  # 858 ETH

    txs.append(
        weth.approve(OETH_VAULT, oeth_amount, std)
    )

    # Mint OETH with WETH, 1:1
    txs.append(
        oeth_vault_core.mint(WETH, oeth_amount, oeth_amount, std)
    )

    txs.append(
        woeth.deposit(oeth_amount, MULTICHAIN_STRATEGIST, std)
    )

    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # AMO pool before
    ethPoolBalance = oeth_metapool.balance()
    oethPoolBalance = oeth.balanceOf(OETH_METAPOOL)
    totalPool = ethPoolBalance + oethPoolBalance
    weth_out_before = oeth_metapool.get_dy(1, 0, 10**18)

    print("Curve OETH/ETH Pool before")  
    print("Pool ETH   ", "{:.6f}".format(ethPoolBalance / 10**18), ethPoolBalance * 100 / totalPool)
    print("Pool OETH  ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)

    # Deposit WETH to old Convex AMO
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_CONVEX_OETH_ETH_STRAT, 
        [WETH],
        [oeth_amount],
        {'from': STRATEGIST}
      )
    )

    # AMO pool after
    ethPoolBalance = oeth_metapool.balance()
    oethPoolBalance = oeth.balanceOf(OETH_METAPOOL)
    totalPool = ethPoolBalance + oethPoolBalance
    weth_out_after = oeth_metapool.get_dy(1, 0, 10**18)

    print("Curve OETH/ETH Pool after")  
    print("Pool  ETH   ", "{:.6f}".format(ethPoolBalance / 10**18), ethPoolBalance * 100 / totalPool)
    print("Pool OETH   ", "{:.6f}".format(oethPoolBalance / 10**18), oethPoolBalance * 100 / totalPool)
    print("Pool Total ", "{:.6f}".format(totalPool / 10**18), totalPool)
    print("Sell 10 OETH Curve prices before and after", "{:.6f}".format(weth_out_before / 10**18), "{:.6f}".format(weth_out_after / 10**18))

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

    # woeth_amount = woeth.balanceOf(MULTICHAIN_STRATEGIST)
    woeth_amount = woeth_amount = 758.85 * 10**18  # 758.85 ETH

    print("Minted  OETH ", "{:.6f}".format(oeth_amount / 10**18), oeth_amount)
    print("Minted wOETH ", "{:.6f}".format(woeth_amount / 10**18), woeth_amount)

    txs.append(
      woeth.approve(CCIP_ROUTER, woeth_amount, std)
    )

    BASE_CHAIN_SELECTOR = 15971525489660198786

    ccip_message = [
          eth_abi.encode(['address'], [OETHB_MULTICHAIN_STRATEGIST]),
          '0x',
          [(WOETH, woeth_amount)],
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

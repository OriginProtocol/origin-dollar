
# -------------------------------------
# Nov 4, 2024 - Deposit 1,024 WETH to the Second Native Staking Strategy
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
        # 32 validator
        [1024 * 10**18],
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
# Nov 8, 2024 - CCIP Bridging
# -------------------------------------
from world import *
import eth_abi
from eth_abi.packed import encode_packed

def main():
  with TemporaryForkForReallocations() as txs:
    amount = woeth.balanceOf(STRATEGIST)

    txs.append(
      woeth.approve(CCIP_ROUTER, amount, std)
    )

    BASE_CHAIN_SELECTOR = 15971525489660198786

    fee_amount = 0.003 * 10**18

    txs.append(
      ccip_router.ccipSend(
        BASE_CHAIN_SELECTOR,
        [
          eth_abi.encode(['address'], [OETHB_STRATEGIST]),
          '0x',
          [(WOETH, amount)],
          ADDR_ZERO,
          '0x97a657c900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
        ],
        { 'value': fee_amount, 'from': STRATEGIST }
      )
    )

# -------------------------------------
# Nov 19, 2024 - Deposit 96 WETH to the Third Native Staking Strategy
# -------------------------------------
from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Before
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Send 100 SSV to the third Native Staking Strategy
    ssv.transfer(
      OETH_NATIVE_STAKING_3_STRAT, 
      100 * 10**18,
      {'from': STRATEGIST}
    )

    # Deposit WETH to Native Staking Strategy
    txs.append(
      vault_oeth_admin.depositToStrategy(
        OETH_NATIVE_STAKING_3_STRAT, 
        [WETH], 
        # 3 validator
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

# -------------------------------------------
# Nov 20 2024 - Add 150 SSV to second Native Staking SSV Cluster
# -------------------------------------------

from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    # Send 150 SSV to the first Native Staking Strategy
    amount = 150 * 10**18
    txs.append(
      ssv.transfer(
        OETH_NATIVE_STAKING_2_STRAT, 
        amount,
        {'from': STRATEGIST}
      )
    )

    txs.append(
      native_staking_2_strat.depositSSV(
        # SSV Operator Ids
        [752, 753, 754, 755], 
        amount,
        # SSV Cluster details:
        # validatorCount, networkFeeIndex, index, active, balance
        [500, 97648369159, 9585132, True, 66288969170302776597],
        {'from': STRATEGIST}
      )
    )

# -------------------------------------
# Nov 21, 2024 - Deposit 3,200 WETH to the Third Native Staking Strategy
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
        OETH_NATIVE_STAKING_3_STRAT, 
        [WETH], 
        # 100 validator
        [3200 * 10**18],
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


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

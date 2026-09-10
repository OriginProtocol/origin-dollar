# -------------------------------------
# Withdraw all from OUSD
# -------------------------------------

from world import *
def withdraw_all_ousd():
    with TemporaryForkForReallocations() as txs:
        # Before
        txs.append(vault_core.rebase({'from': STRATEGIST}))
        txs.append(vault_value_checker.takeSnapshot({'from': STRATEGIST}))

        # Withdraw all from strategies
        txs.append(vault_admin.withdrawAllFromStrategies({'from': STRATEGIST}))

        # After
        vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
        supply_change = ousd.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
        profit = vault_change - supply_change

        txs.append(
            vault_value_checker.checkDelta(
                profit,
                (500 * 10**18),
                vault_change,
                (300000 * 10**18),
                {'from': STRATEGIST}
            )
        )
        print("-----")
        print("Profit", "{:.6f}".format(profit / 10**18), profit)
        print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
withdraw_all_ousd()

# -------------------------------------
# Withdraw all from OETH
# -------------------------------------
from world import *
def withdraw_all_oeth():
    with TemporaryForkForReallocations() as txs:
        # Before
        txs.append(vault_oeth_core.rebase({'from': STRATEGIST}))
        txs.append(oeth_vault_value_checker.takeSnapshot({'from': STRATEGIST}))

        # Withdraw all from strategies
        txs.append(vault_oeth_admin.withdrawAllFromStrategies({'from': STRATEGIST}))

        # After
        vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
        supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
        profit = vault_change - supply_change

        txs.append(
            oeth_vault_value_checker.checkDelta(
                profit,
                (0.1 * 10**18),
                vault_change,
                (10 * 10**18),
                {'from': STRATEGIST}
            )
        )
        print("-----")
        print("Profit", "{:.6f}".format(profit / 10**18), profit)
        print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
withdraw_all_oeth()

# -------------------------------------
# Withdraw all from Sonic
# -------------------------------------
from world_sonic import *
def withdraw_all_sonic():
    from world_sonic import *

    with TemporaryForkForReallocations() as txs:
        # Before
        txs.append(vault_core.rebase({'from': SONIC_STRATEGIST}))
        txs.append(vault_value_checker.takeSnapshot({'from': SONIC_STRATEGIST}))

        # Withdraw all from strategies
        txs.append(vault_admin.withdrawAllFromStrategies({'from': SONIC_STRATEGIST}))

        # After
        vault_change = vault_core.totalValue() - vault_value_checker.snapshots(SONIC_STRATEGIST)[0]
        supply_change = os.totalSupply() - vault_value_checker.snapshots(SONIC_STRATEGIST)[1]
        profit = vault_change - supply_change

        txs.append(
            vault_value_checker.checkDelta(
                profit,
                (500 * 10**18),
                vault_change,
                (300000 * 10**18),
                {'from': SONIC_STRATEGIST}
            )
        )
        print("-----")
        print("Profit", "{:.6f}".format(profit / 10**18), profit)
        print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

withdraw_all_sonic()
# -------------------------------------------------------------
# Jun 15, 2026 - Move WETH from old Compounding Staking SSV Strategy to new Compounding Staking Strategy
# -------------------------------------------------------------

from world import *


def main():
  with TemporaryForkForReallocations() as txs:
    amount = 9_780 * 10**18

    # Before
    txs.append(vault_oeth_admin.unpauseRebase(std))
    txs.append(vault_oeth_core.rebase(std))
    txs.append(oeth_vault_value_checker.takeSnapshot(std))

    # Withdraw all from old Compounding Staking SSV Strategy
    txs.append(
      vault_oeth_admin.withdrawAllFromStrategy(
        COMPOUNDING_STAKING_SSV_STRAT,
        {'from': STRATEGIST}
      )
    )

    vault_weth = weth.balanceOf(VAULT_OETH_PROXY_ADDRESS)
    print("Vault WETH after withdrawAll", "{:.6f}".format(vault_weth / 10**18), vault_weth)
    assert vault_weth >= amount, "Not enough WETH in the OETH Vault"

    # Deposit 9,780 WETH to new Compounding Staking Strategy
    txs.append(
      vault_oeth_admin.depositToStrategy(
        COMPOUNDING_STAKING_STRAT,
        [WETH],
        [amount],
        std
      )
    )

    # After
    vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
    supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(oeth_vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), std))

    print("-----")
    print("Deposited WETH", "{:.6f}".format(amount / 10**18), amount)
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("OETH supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

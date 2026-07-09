# -------------------------------------------------------------
# Jul 10, 2026 - Withdraw all liquidity from Hydrex AMO into the Super OETH Vault
# -------------------------------------------------------------

from world_base import *


def main():
  with TemporaryForkForOETHbReallocations() as txs:
    # Before
    txs.append(vault_core.rebase(from_strategist))
    txs.append(vault_value_checker.takeSnapshot(from_strategist))

    vault_weth_before = weth.balanceOf(OETHB_VAULT_PROXY_ADDRESS)
    hydrex_weth_before = hydrex_amo_strat.checkBalance(WETH_BASE)

    print("-----")
    print("Hydrex WETH before", c18(hydrex_weth_before), hydrex_weth_before)
    print("Vault WETH before ", c18(vault_weth_before), vault_weth_before)
    print("-----")

    # Withdraw all WETH liquidity from the Hydrex AMO strategy into the vault.
    txs.append(
      vault_admin.withdrawAllFromStrategy(
        OETHB_HYDREX_AMO_STRATEGY,
        from_strategist
      )
    )

    vault_weth_after = weth.balanceOf(OETHB_VAULT_PROXY_ADDRESS)
    hydrex_weth_after = hydrex_amo_strat.checkBalance(WETH_BASE)
    withdrawn_weth = vault_weth_after - vault_weth_before

    assert hydrex_weth_after == 0, "Hydrex AMO still has WETH balance"
    assert withdrawn_weth > 0, "No WETH was withdrawn into the vault"

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_MULTICHAIN_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_MULTICHAIN_STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (10 * 10**18), from_strategist))

    print("-----")
    print("Hydrex WETH after ", c18(hydrex_weth_after), hydrex_weth_after)
    print("Vault WETH after  ", c18(vault_weth_after), vault_weth_after)
    print("Withdrawn WETH    ", c18(withdrawn_weth), withdrawn_weth)
    print("Profit            ", c18(profit), profit)
    print("OETHb supply change", c18(supply_change), supply_change)
    print("Vault Change      ", c18(vault_change), vault_change)
    print("-----")


# -------------------------------------------------------------
# Jul 10, 2026 - Withdraw 15 WETH from Base Curve AMO into the Super OETH Vault
# -------------------------------------------------------------

from world_base import *


def main():
  with TemporaryForkForOETHbReallocations() as txs:
    amount = 15 * 10**18

    # Before
    txs.append(vault_core.rebase(from_strategist))
    txs.append(vault_value_checker.takeSnapshot(from_strategist))

    vault_weth_before = weth.balanceOf(OETHB_VAULT_PROXY_ADDRESS)
    curve_amo_weth_before = base_curve_amo_strat.checkBalance(WETH_BASE)

    print("-----")
    print("Curve AMO WETH before", c18(curve_amo_weth_before), curve_amo_weth_before)
    print("Vault WETH before    ", c18(vault_weth_before), vault_weth_before)
    print("Withdraw amount      ", c18(amount), amount)
    print("-----")

    assert curve_amo_weth_before >= amount, "Curve AMO has less than 15 WETH"

    # Withdraw 15 WETH from the Base Curve AMO strategy into the vault.
    txs.append(
      vault_admin.withdrawFromStrategy(
        OETHB_CURVE_AMO_STRATEGY,
        [WETH_BASE],
        [amount],
        from_strategist
      )
    )

    vault_weth_after = weth.balanceOf(OETHB_VAULT_PROXY_ADDRESS)
    curve_amo_weth_after = base_curve_amo_strat.checkBalance(WETH_BASE)
    withdrawn_weth = vault_weth_after - vault_weth_before

    assert withdrawn_weth >= amount, "15 WETH was not withdrawn into the vault"

    # After
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(OETHB_MULTICHAIN_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(OETHB_MULTICHAIN_STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (10 * 10**18), from_strategist))

    print("-----")
    print("Curve AMO WETH after ", c18(curve_amo_weth_after), curve_amo_weth_after)
    print("Vault WETH after     ", c18(vault_weth_after), vault_weth_after)
    print("Withdrawn WETH       ", c18(withdrawn_weth), withdrawn_weth)
    print("Profit               ", c18(profit), profit)
    print("OETHb supply change  ", c18(supply_change), supply_change)
    print("Vault Change         ", c18(vault_change), vault_change)
    print("-----")

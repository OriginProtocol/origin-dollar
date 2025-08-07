from world_base import *
def main():
  with TemporaryForkForReallocations() as txs:
    txs.append(vault_core.rebase(from_strategist))
    txs.append(vault_value_checker.takeSnapshot(from_strategist))

    txs.append(vault_admin.depositToStrategy(OETHB_CURVE_AMO_STRATEGY, [WETH_BASE], [4050 * 10**18], from_strategist))

    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[0]
    supply_change = oethb.totalSupply() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[1]
    profit = vault_change - supply_change

    txs.append(vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (1 * 10**18), from_strategist))
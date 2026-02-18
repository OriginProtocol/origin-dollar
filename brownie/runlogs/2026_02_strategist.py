# -------------------------------------------------------------
# Feb 16, 2026 - Allocate 100 USDC to the Crosschain strategy
# -------------------------------------------------------------
from world import *
def main():
  with TemporaryForkForReallocations() as txs:
    txs.append(vault_core.rebase({'from': MULTICHAIN_STRATEGIST}))
    txs.append(vault_value_checker.takeSnapshot({'from': MULTICHAIN_STRATEGIST}))

    txs.append(vault_admin.depositToStrategy(
      CROSSCHAIN_MORPHO_V2_BASE_MASTER_STRATEGY,
      [usdc],
      [100 * 10**6],
      {'from': MULTICHAIN_STRATEGIST}
    ))
    vault_change = vault_core.totalValue() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[0]
    supply_change = ousd.totalSupply() - vault_value_checker.snapshots(MULTICHAIN_STRATEGIST)[1]
    profit = vault_change - supply_change
    txs.append(vault_value_checker.checkDelta(profit, (1 * 10**18), vault_change, (1 * 10**18), {'from': MULTICHAIN_STRATEGIST}))
    print("-----")
    print("Profit", "{:.6f}".format(profit / 10**18), profit)
    print("USDC supply change", "{:.6f}".format(supply_change / 10**18), supply_change)
    print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
    print("-----")

# -------------------------------------------
# Feb 17 2026 - Add SSV to second and third Native Staking SSV Clusters
# -------------------------------------------

from world import *

def main():
  with TemporaryForkForReallocations() as txs:
    amount = 228 * 10**18
    txs.append(
      ssv.transfer(
        OETH_NATIVE_STAKING_2_STRAT, 
        amount,
        {'from': STRATEGIST}
      )
    )

    # use the following command to get cluster info:
    # pnpm hardhat getClusterInfo --operatorids 752,753,754,755 --network mainnet --owner 0x4685dB8bF2Df743c861d71E6cFb5347222992076

    txs.append(
      native_staking_2_strat.depositSSV(
        # SSV Operator Ids
        [752, 753, 754, 755], 
        amount,
        # SSV Cluster details:
        # validatorCount, networkFeeIndex, index, active, balance
        [485, 416695837505, 9585132, True, 433293212143542776597],
        {'from': STRATEGIST}
      )
    )

    amount = 48 * 10**18
    txs.append(
      ssv.transfer(
        OETH_NATIVE_STAKING_3_STRAT, 
        amount,
        {'from': STRATEGIST}
      )
    )

    # use the following command to get cluster info:
    # pnpm hardhat getClusterInfo --operatorids 338,339,340,341 --network mainnet --owner 0xE98538A0e8C2871C2482e1Be8cC6bd9F8E8fFD63

    txs.append(
      native_staking_3_strat.depositSSV(
        # SSV Operator Ids
        [338, 339, 340, 341],
        amount,
        # SSV Cluster details:
        # validatorCount, networkFeeIndex, index, active, balance
        [88, 406033866602, 0, True, 93251662533120000000],
        {'from': STRATEGIST}
      )
    )

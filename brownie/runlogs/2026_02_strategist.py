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

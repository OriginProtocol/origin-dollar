# -------------------------------------
# Nov 09, 2023 - OETH Buyback
# -------------------------------------
from buyback import *

def main():
  txs = []

  with TemporaryFork():
    # Transfer all OETH from Strategist to the buyback contract
    txs.append(
      oeth.transfer(OETH_BUYBACK, oeth.balanceOf(STRATEGIST), std)
    )

    txs.append(
      build_buyback_tx(
        OETH,
        oeth.balanceOf(OETH_BUYBACK),
        max_ogv_slippage=3,
        max_cvx_slippage=3.5
      )
    )

    print(to_gnosis_json(txs))

# -------------------------------------
# Nov 09, 2023 - OUSD Buyback
# -------------------------------------
from buyback import *

def main():
  txs = []

  with TemporaryFork():
    txs.append(
      build_buyback_tx(
        OUSD,
        ousd.balanceOf(OUSD_BUYBACK),
        max_ogv_slippage=3,
        max_cvx_slippage=3.5
      )
    )

    print(to_gnosis_json(txs))
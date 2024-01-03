# -------------------------------------
# Jan 03, 2023 - OETH Buyback
# -------------------------------------
from buyback import *

def main():
  txs = []

  with TemporaryFork():
    txs.append(
      build_buyback_tx(
        OETH,
        oeth.balanceOf(OETH_BUYBACK),
        max_ogv_slippage=1.25,
        max_cvx_slippage=2.5
      )
    )

    print(to_gnosis_json(txs))

# -------------------------------------
# Jan 03, 2023 - CVX relock
# -------------------------------------
from buyback import *

def main():
  txs = []

  with TemporaryFork():
    txs.append(
      cvx_locker.processExpiredLocks(True, std)
    )

    print(to_gnosis_json(txs))


# -------------------------------------
# Jan 03, 2023 - OUSD Buyback
# -------------------------------------
from buyback import *

def main():
  txs = []

  with TemporaryFork():
    txs.append(
      build_buyback_tx(
        OUSD,
        ousd.balanceOf(OUSD_BUYBACK),
        max_ogv_slippage=1.25,
        max_cvx_slippage=3
      )
    )

    print(to_gnosis_json(txs))

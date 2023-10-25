from world import *


from oneinch import get_1inch_swap_data

def lock_cvx(with_fork=True):
  if with_fork:
    txs = []
    with TemporaryFork():
      txs.append(
        cvx_locker.lock(STRATEGIST, cvx.balanceOf(STRATEGIST), 0, {'from': STRATEGIST})
      )

    print("Schedule the following transactions on Gnosis Safe")
    for idx, item in enumerate(txs):
      print("Transaction ", idx)
      print("To: ", item.receiver)
      print("Data (Hex encoded): ", item.input, "\n")
  else:
    return cvx_locker.lock(STRATEGIST, cvx.balanceOf(STRATEGIST), 0, {'from': STRATEGIST})

def build_cvx_buyback_tx(slippage=1):
    txs = []
    with TemporaryFork():
        oeth_balance = oeth.balanceOf(STRATEGIST)
        ousd_balance = ousd.balanceOf(STRATEGIST)

        # Approve 1-inch to move OETH and OUSD
        txs.append(
            oeth.approve(ROUTER_1INCH_V5, oeth_balance, {'from': STRATEGIST})
        )
        txs.append(
            ousd.approve(ROUTER_1INCH_V5, ousd_balance, {'from': STRATEGIST})
        )

        # Swap OETH for CVX
        txs.append(
            get_1inch_swap_data(
                OETH,
                CVX,
                oeth_balance,
                slippage,
            )
        )

        # Swap OUSD for CVX
        txs.append(
            get_1inch_swap_data(
                OUSD,
                CVX,
                ousd_balance,
                slippage,
            )
        )

        print("----")
        print("Gnosis json:")
        print(to_gnosis_json(txs))
        print("----")

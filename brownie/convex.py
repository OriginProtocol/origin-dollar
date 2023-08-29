from world import *

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


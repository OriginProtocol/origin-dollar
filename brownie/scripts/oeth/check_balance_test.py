# Checks the historical difference between the price of stETH/ETH tokens reported 
# by the Curve pool and Chainlink oracle.
# It checks data-points for every hour going back 1 year and plots the results.

from matplotlib import pyplot as plt
from functools import cmp_to_key

def compare(item1, item2):
  return int(item1) - int(item2)


def plot_results(results):
  fig, ax1 = plt.subplots()
  X = []
  Y = []
  keys = list(results.keys())
  keys = sorted(keys, key=cmp_to_key(compare))
  for diff_bp in keys:
      X.append(diff_bp)
      Y.append(results[diff_bp])
  ax1.plot(X,Y, 'g-')
  ax1.grid()
  ax1.set_xlabel('Basis point difference')
  ax1.set_ylabel('Frequency', color='g')
  plt.title("Basis point difference between Curve & Oracle prices")
  plt.show()

def calculate_percentiles(results):
  keys = list(results.keys())
  keys = sorted(keys, key=cmp_to_key(compare))
  total = 0
  for diff_bp in keys:
    total += results[diff_bp]
  percentiles = [0.5, 0.9, 0.95, 0.99]
  acc = 0
  for diff_bp in keys:
    acc_before = acc
    acc += results[diff_bp]
    for percentile in percentiles:
      if acc_before / total < percentile and acc / total > percentile:
        print("{} percentile at {} basis points".format(percentile * 100, diff_bp))


# stEth/ETH curve pool 
pool = Contract.from_explorer("0xdc24316b9ae028f1497c275eb9192a3ea0f67022")
# stEth/ETH oracle
oracle = Contract.from_explorer("0x86392dc19c0b719886221c78ab11eb8cf5c52812")


blockStep = 300 # ~1h worth in block numbers
latestBlock = web3.eth.blockNumber
  
# loop every hour for 1 year
results = {}
for i in range(24 * 365):
  try:
    blockNumber = latestBlock - i * blockStep
    [_, oraclePrice, __, ___, ____] = oracle.latestRoundData(block_identifier=blockNumber)
    poolPrice = pool.get_dy(1,0,1e18, block_identifier=blockNumber)
    difference = round(abs((poolPrice - oraclePrice) / ((poolPrice + oraclePrice) / 2)) * 10000)

    key = str(difference)
    if key not in results:
      results[key] = 1
    else:
      results[key] = results[key] + 1

    if i % 100 == 0:
      print("Gotten to: " + str(i))
      print(results)
  except:
    # do nothing just continue
    pass

print(results)
plot_results(results)
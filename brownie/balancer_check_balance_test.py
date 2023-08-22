# The purpose of this script is to find out:
# - if check balance can be manipulated to return inflated / deflated 
#   results upon tilting the Balancer pool.
# - the accuracy of assets that check balance reports when pool is tilted.
#   Meaning that we test the withdrawal and see if the amounts reported by 
#   checkBalance are close to the actual ones.
#

from world import *
import math

reth = Contract.from_explorer(RETH)

#STD = {"from": vault_oeth_admin, "gas_price": 100}
STD = {"from": vault_oeth_admin}
BALANCER_STRATEGY = "0x1ce298Ec5FE0B1E4B04fb78d275Da6280f6e82A3"
weth_whale = "0xf04a5cc80b1e94c69b48f5ee68a08cd2f09a7c3e"
reth_whale = "0xCc9EE9483f662091a1de4795249E24aC0aC2630f"
WSTD = {"from": weth_whale}

weth.transfer(vault_oeth_core, 1000e18, WSTD)
reth.transfer(weth_whale, 27e21, {"from": reth_whale})
balancer_reth_strat = load_contract('balancer_strat', BALANCER_STRATEGY)


# MANIPULATE THE POOL
ba_vault = Contract.from_explorer("0xBA12222222228d8Ba445958a75a0704d566BF2C8")
balancerUserDataEncoder = load_contract('balancerUserData', vault_oeth_admin.address)
pool = Contract.from_explorer("0x1e19cf2d73a72ef1332c882f20534b6519be0276")
aura_reward_pool = Contract.from_explorer("0xDd1fE5AD401D4777cE89959b7fa587e569Bf125D")

# rETH / WETH
pool_id = "0x1e19cf2d73a72ef1332c882f20534b6519be0276000200000000000000000112"
rewardPool = Contract.from_explorer("0xdd1fe5ad401d4777ce89959b7fa587e569bf125d")

weth.approve(ba_vault, 10**50, WSTD)
reth.approve(ba_vault, 10**50, WSTD)
  
balancer_reth_strat.setMaxDepositSlippage(1e16, std)
vault_oeth_admin.depositToStrategy(BALANCER_STRATEGY, [weth], [1000 * 1e18], {'from': STRATEGIST})

def get_bpt_tokens_in_aura():
  return aura_reward_pool.maxRedeem(balancer_reth_strat)

def getStrategyBalances(): 
  #reth_balance = balancer_reth_strat.checkBalance(reth) * reth.getExchangeRate() / 1e36
  reth_balance = balancer_reth_strat.checkBalance(reth) / 1e18
  weth_balance = balancer_reth_strat.checkBalance(weth) / 1e18
  unit_balance = balancer_reth_strat.checkBalance() / 1e18

  return [
    reth_balance,
    weth_balance,
    unit_balance
  ]

def getStrategyTokenBalances(): 
  #reth_balance = balancer_reth_strat.checkBalance(reth) * reth.getExchangeRate() / 1e36
  reth_balance = reth.balanceOf(balancer_reth_strat.address) / 1e18
  weth_balance = weth.balanceOf(balancer_reth_strat.address) / 1e18
  unit_balance = weth_balance + reth_balance * reth.getExchangeRate() / 1e18

  return [
    reth_balance,
    weth_balance,
    unit_balance
  ]


def deposit_reth(amount, from_acc):
  # Enter the pool
  ba_vault.joinPool(
    pool_id,
    from_acc, #sender
    from_acc, #recipient
    [
      # tokens need to be sorted numerically
      [reth.address, weth.address], # assets
      # indexes match above assets
      [amount, 0], # min amounts in
       # balancerUserDataEncoder.userDataTokenInExactBPTOut.encode_input(2, 36158323235261660260, 1)[10:]
       # balancerUserDataEncoder.userDataTokenInExactBPTOut.encode_input(2, 123, 1)[10:]
      balancerUserDataEncoder.userDataExactTokenInForBPTOut.encode_input(1, [amount, 0], 0)[10:],
      False, #fromInternalBalance
    ],
    {"from": from_acc}
  )

def deposit_weth(amount, from_acc):
  # Enter the pool
  ba_vault.joinPool(
    pool_id,
    from_acc, #sender
    from_acc, #recipient
    [
      # tokens need to be sorted numerically
      [reth.address, weth.address], # assets
      # indexes match above assets
      [0, amount], # min amounts in
       # balancerUserDataEncoder.userDataTokenInExactBPTOut.encode_input(2, 36158323235261660260, 1)[10:]
       # balancerUserDataEncoder.userDataTokenInExactBPTOut.encode_input(2, 123, 1)[10:]
      balancerUserDataEncoder.userDataExactTokenInForBPTOut.encode_input(1, [0, amount], 0)[10:],
      False, #fromInternalBalance
    ],
    {"from": from_acc}
  )

def exit_pool():
  bpt_in_aura = get_bpt_tokens_in_aura()
  aura_reward_pool.withdrawAllAndUnwrap(True, {"from": balancer_reth_strat})

  # Exit the pool
  ba_vault.exitPool(
    pool_id,
    balancer_reth_strat.address, #sender
    balancer_reth_strat.address, #recipient
    [
      # tokens need to be sorted numerically
      # we should account for some slippage here since it comes down to balance amounts in the pool
      [reth.address, weth.address], # assets
      [0, 0], # min amounts out
       # userData = balancerUserDataEncoder.userDataTokenInExactBPTOut.encode_input(0, bpt_balance, 0)
      balancerUserDataEncoder.userDataExactBPTinForTokensOut.encode_input(1, bpt_in_aura)[10:],
      False, #fromInternalBalance
    ],
    {"from": balancer_reth_strat}
  )

def print_metric(name, base_state, new_state):
  diff = new_state - base_state
  change = diff/base_state
  print("{}: base: {:0.4f} change: {:0.3f}%".format(name, base_state, change * 100))


def print_pool_state():
  [token,balances,last_change] = ba_vault.getPoolTokens(pool_id)
  pool_reth_units = balances[0] * reth.getExchangeRate() / 1e36
  pool_reth = balances[0] / 1e18
  pool_weth = balances[1] / 1e18
  print("Pool balances reth(in units)/reth/weth: {:0.2f}/{:0.2f}/{:0.2f}".format(pool_reth_units, pool_reth, pool_weth))

# this test confirms that tilting the pool heavily towards a single asset doesn't affect
# the amounts hat check balance is reporting
def main_test_check_balance_tilt(): 
  deposit_amounts = range (2_000, 100_000, 5_000)
  (base_reth_balance, base_weth_balance, base_unit_balance) = getStrategyBalances()
  bpt_in_aura = get_bpt_tokens_in_aura()
  print("BPT in strategy: {:0.2f}".format(bpt_in_aura / 1e18))
  for amount in deposit_amounts:
    with TemporaryFork():
      #stats = test_check_balance_tilt_manipulation(10, True)
      deposit_weth(amount * 1e18, weth_whale)
      print_pool_state()
      (reth_balance, weth_balance, unit_balance) = getStrategyBalances()
      print_metric("RETH", base_reth_balance, reth_balance)
      print_metric("WETH", base_weth_balance, weth_balance)
      print_metric("UNIT", base_unit_balance, unit_balance)

# test how accurate are the values reported by the checkBalance
def main_test_check_balance_accuracy():
  deposit_amounts = range (1, 100_000, 5_000)
  base_reth_balance = 0
  base_weth_balance = 0

  for amount in deposit_amounts:
    with TemporaryFork():
      deposit_weth(amount * 1e18, weth_whale)
      (reth_balance_check_balance, weth_balance_check_balance, unit_balance_check_balance) = getStrategyBalances()
      exit_pool()
      (reth_balance_actual, weth_balance_actual, unit_balance_actual) = getStrategyTokenBalances()
      print_metric("RETH", reth_balance_check_balance, reth_balance_actual)
      print_metric("WETH", weth_balance_check_balance, weth_balance_actual)
      print_metric("UNIT", unit_balance_check_balance, unit_balance_actual)

#main_test_check_balance_tilt()
main_test_check_balance_accuracy()

# plot results
# import matplotlib.pyplot as plt
# import numpy as np

# x = range (2_000, 200_000, 5_000)
# y = []
# for amount in x:
#   with TemporaryFork():
#     stats = test_check_balance_tilt_manipulation(amount, True)
#     y.append(stats["whale_weth_diff"])
#     print("stats", stats["whale_weth_diff"])

# # X axis parameter:
# xaxis = np.array(x)
# # Y axis parameter:
# yaxis = np.array(y)

# plt.plot(xaxis, yaxis)
# plt.show()
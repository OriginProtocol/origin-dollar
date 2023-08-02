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
# rETH / WETH
pool_id = "0x1e19cf2d73a72ef1332c882f20534b6519be0276000200000000000000000112"
rewardPool = Contract.from_explorer("0xdd1fe5ad401d4777ce89959b7fa587e569bf125d")

weth.approve(ba_vault, 10**50, WSTD)
reth.approve(ba_vault, 10**50, WSTD)
vault_oeth_admin.depositToStrategy(BALANCER_STRATEGY, [weth], [1000 * 1e18], {'from': STRATEGIST})

def print_state(state_name, print_states):
  if not print_states:
    return

  [token,balances,last_change] = ba_vault.getPoolTokens(pool_id)
  reth_balance = balancer_reth_strat.checkBalance(reth) * reth.getExchangeRate() / 1e36
  weth_balance = balancer_reth_strat.checkBalance(weth) / 1e18

  reth_balance_2 = balancer_reth_strat.checkBalance2(reth) * reth.getExchangeRate() / 1e36
  weth_balance_2 = balancer_reth_strat.checkBalance2(weth) / 1e18

  print("State: {0}".format(state_name))
  print("")
  print("Strategy:")
  print("WETH balance: {:0.2f}".format(weth_balance))
  print("RETH balance (normalized exhange rate): {:0.2f}".format(reth_balance))
  print("Combined ETH balance: {:0.2f}".format(reth_balance + weth_balance))
  print("WETH balance 2: {:0.2f}".format(weth_balance_2))
  print("RETH balance 2(normalized exhange rate): {:0.2f}".format(reth_balance_2))
  print("Combined ETH balance 2: {:0.2f}".format(reth_balance_2 + weth_balance_2))
  print("Total asset balance: {:0.2f}".format(balancer_reth_strat.checkBalance() / 1e18))
  print("BPT balance: {:0.2f}".format(rewardPool.balanceOf(balancer_reth_strat) / 1e18))
  print("")
  print("Pool:")
  pool_reth = balances[0] * reth.getExchangeRate() / 1e36
  pool_weth = balances[1] / 1e18
  print("balances reth(normalized)/weth: {:0.2f}/{:0.2f}".format(pool_reth, pool_weth))
  print("tvl: {:0.2f}".format(pool_reth + pool_weth))
  print("")
  print("Whale")
  bpt_balance = pool.balanceOf(weth_whale)
  print("bpt_balance: {:0.2f}".format(bpt_balance / 1e18))
  print("WETH balance: {:0.2f}".format(weth.balanceOf(weth_whale) / 1e18))
  print("")

def mint(amount, asset=weth):
  asset.approve(oeth_vault_core, 1e50, WSTD)
  oeth_vault_admin.setAssetDefaultStrategy(asset, balancer_reth_strat, {"from": timelock})

  oeth_vault_core.mint(asset.address, amount * math.pow(10, asset.decimals()), 0, WSTD)
  oeth_vault_core.allocate(WSTD)
  oeth_vault_core.rebase(WSTD)

def redeem(amount):
  oeth.approve(oeth_vault_core, 1e50, WSTD)
  oeth_vault_core.redeem(amount*1e18, amount*1e18*0.95, WSTD)
  oeth_vault_core.rebase(WSTD)

def deposit_withdrawal_test(amount, print_states = False): 
  print_state("initial state", print_states)

  mint(400, weth)
  print_state("whale minted", print_states)

  vault_value_checker.takeSnapshot(STD)

  weth_balance_before_whale = weth.balanceOf(weth_whale)
  # Enter the pool
  ba_vault.joinPool(
    pool_id,
    weth_whale, #sender
    weth_whale, #recipient
    [
      # tokens need to be sorted numerically
      [reth.address, weth.address], # assets
      # indexes match above assets
      [0, amount * 10**18], # min amounts in
      balancerUserDataEncoder.userDataExactTokenInForBPTOut.encode_input(1, [0, amount * 10**18], amount * 10**18 * 0.85)[10:],
      False, #fromInternalBalance
    ],
    WSTD
  )

  print_state("after manipulation", print_states)

  ## attempt to mint - fails with Bal208 -> BPT_OUT_MIN_AMOUNT (Slippage/front-running protection check failed on a pool join)
  #mint(1, weth)
  ## attempt to redeem
  redeem(400)

  bpt_balance = pool.balanceOf(weth_whale)
  pool.approve(ba_vault, 10**50, WSTD)

  ba_vault.exitPool(
    pool_id,
    weth_whale, #sender
    weth_whale, #recipient
    [
      # tokens need to be sorted numerically
      # we should account for some slippage here since it comes down to balance amounts in the pool
      [reth.address, weth.address], # assets
      #[0, 177_972 * 10**18], # min amounts out
      [0, 0], # min amounts out - no MEWS on local network no need to calculate exaclty
      balancerUserDataEncoder.userDataTokenInExactBPTOut.encode_input(0, bpt_balance, 1)[10:],
      False, #fromInternalBalance
    ],
    WSTD
  )

  weth_balance_diff_whale = (weth_balance_before_whale - weth.balanceOf(weth_whale))/weth_balance_before_whale

  vault_value_checker.checkDelta(0, 0.5*10**18, 0, 0.5*10**18, STD)
  print_state("after exit", print_states)

  return {
    "whale_weth_diff": weth_balance_diff_whale
  }

with TemporaryFork():
  stats = deposit_withdrawal_test(200_000, True)

# plot results
# import matplotlib.pyplot as plt
# import numpy as np

# x = range (2_000, 200_000, 5_000)
# y = []
# for amount in x:
#   with TemporaryFork():
#     stats = deposit_withdrawal_test(amount, True)
#     y.append(stats["whale_weth_diff"])
#     print("stats", stats["whale_weth_diff"])

# # X axis parameter:
# xaxis = np.array(x)
# # Y axis parameter:
# yaxis = np.array(y)

# plt.plot(xaxis, yaxis)
# plt.show()
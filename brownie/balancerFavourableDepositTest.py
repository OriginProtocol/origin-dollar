from world import *
import math

reth = Contract.from_explorer(RETH)

#STD = {"from": vault_oeth_admin, "gas_price": 100}
STD = {"from": vault_oeth_admin}
BALANCER_STRATEGY = "0x1ce298Ec5FE0B1E4B04fb78d275Da6280f6e82A3"
weth_whale = "0xf04a5cc80b1e94c69b48f5ee68a08cd2f09a7c3e"
reth_whale = "0xCc9EE9483f662091a1de4795249E24aC0aC2630f"
WSTD = {"from": weth_whale}
RSTD = {"from": reth_whale}

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
weth.approve(ba_vault, 10**50, RSTD)
reth.approve(ba_vault, 10**50, RSTD)

def print_state():
  [token,balances,last_change] = ba_vault.getPoolTokens(pool_id)
  print("")
  print("Account BPT balance: {:0.2f}".format(pool.balanceOf(weth_whale) / 1e18))
  print("")
  print("Pool:")
  pool_reth_units = balances[0] * reth.getExchangeRate() / 1e36
  pool_reth = balances[0] / 1e18
  pool_weth = balances[1] / 1e18
  print("balances reth(in units)/reth/weth: {:0.2f}/{:0.2f}/{:0.2f}".format(pool_reth_units, pool_reth, pool_weth))
  print("tvl: {:0.2f}".format(pool_reth + pool_weth))
  print("")

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

with TemporaryFork():
	# deposit_reth(10e18, WSTD)
	# print_state()

	#weth_amount = 50 * 10**18
	#weth_amount = 1 * 10**21
	weth_amount = 2 * 10**21
	#weth_amount = 3 * 10**21

	#weth_amount = 20 * 10**21
	# weth_amount = 50 * 10**21
	#weth_amount = 100 * 10**21
	# weth_amount = 250 * 10**21

	weth.transfer(reth_whale, weth_amount, WSTD)
	deposit_weth(weth_amount, reth_whale)
	deposit_reth(10e18, weth_whale)
	print_state()

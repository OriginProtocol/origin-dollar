from metastrategy import *
LUSD_POOL_ADDRESS="0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA"
LUSD_ADDRESS="0x5f98805A4E8be255a32880FDeC7F6728C6568bA0"
LUSD_BAGS="0x66017d22b0f8556afdd19fc67041899eb65a21bb"
SOPS = {"from": STRATEGIST}

lusd = load_contract('ERC20', LUSD_ADDRESS)
# transfer 100 mio LUSD to STRATEGIST
lusd.transfer(STRATEGIST, 100*1e6*1e18, {"from": LUSD_BAGS})
lusd_metapool = load_contract('ousd_metapool', LUSD_POOL_ADDRESS)
usdc.approve(threepool_lp.address, 1e50, OPTS)
usdc.approve(threepool.address, 1e50, OPTS)
lusd.approve(lusd_metapool.address, 1e50, SOPS)
threepool_lp.approve(lusd_metapool, 1e50, SOPS)
threepool_lp.approve(lusd_metapool, 1e50, OPTS)
usdcToDeploy = 10e6*1e6

print("starting LUSD priced in USDC: ", lusd_metapool.get_dy_underlying(0,2,1e18))

def deposit():
	startLp = threepool_lp.balanceOf(me)
	threepool.add_liquidity([0,usdcToDeploy, 0], 0, OPTS)
	diff3Pool = threepool_lp.balanceOf(me) - startLp

	startMetaLp = lusd_metapool.balanceOf(me)
	lusd_metapool.add_liquidity([0, diff3Pool], 0, OPTS)
	return lusd_metapool.balanceOf(me) - startMetaLp

def withdraw(lusdDiff):
	startLp = threepool_lp.balanceOf(me)
	lusd_metapool.remove_liquidity_one_coin(lusdDiff, 1, 0, OPTS)
	diff3Pool = threepool_lp.balanceOf(me) - startLp

	startUsdc = usdc.balanceOf(me)
	tx = threepool.remove_liquidity_one_coin(diff3Pool, 1, 0, OPTS)	
	usdcDiff = usdc.balanceOf(me) - startUsdc
	print("Net USDC difference: ", c6(usdcDiff - usdcToDeploy))

#just deploy and remove liquidity
with TemporaryFork():
	lusdLpDiff = deposit()
	print("LUSD priced in USDC: ", lusd_metapool.get_dy_underlying(0,2,1e18))
	withdraw(lusdLpDiff)
	# lost 160 USDC & LUSD priced at 1.039472

#deploy liquidity, pool gets 5(3pool)/95 ish balanced and remove liquidity
with TemporaryFork():
	lusdLpDiff = deposit()
	#amountLusd = 53 * 1e6 * 1e18 # 1 mio USDC amount
	amountLusd = 61 * 1e6 * 1e18 # 10 mio USDC amount
	lusd_metapool.exchange(0,1,amountLusd, 0, SOPS)
	print("balances: ", lusd_metapool.balances(0) / 1e24, lusd_metapool.balances(1)/1e24)
	print("LUSD priced in USDC: ", lusd_metapool.get_dy_underlying(0,2,1e18))
	withdraw(lusdLpDiff)

#deploy liquidity, pool gets 50/50 ish balanced and remove liquidity
with TemporaryFork():
	lusdLpDiff = deposit()
	# balance lusd metapool
	#lusd_metapool.add_liquidity([49 * 1e6 * 1e18, 0], 0, SOPS) # 1 mio USDC
	lusd_metapool.add_liquidity([59 * 1e6 * 1e18, 0], 0, SOPS) # 10 mio USDC
	print("balances: ", lusd_metapool.balances(0) / 1e24, lusd_metapool.balances(1)/1e24)
	print("LUSD priced in USDC: ", lusd_metapool.get_dy_underlying(0,2,1e18))
	withdraw(lusdLpDiff)
	# lost 5710 USDC & LUSD priced at 0.999690

#deploy liquidity, pool gets 70(3pool)/30 ish balanced and remove liquidity
with TemporaryFork():
	lusdLpDiff = deposit()
	# balance lusd metapool
	# lusd_metapool.add_liquidity([18.3 * 1e6 * 1e18, 0], 0, SOPS) # 1 mio USDC
	lusd_metapool.add_liquidity([23 * 1e6 * 1e18, 0], 0, SOPS) # 10 mio USDC
	print("balances: ", lusd_metapool.balances(0) / 1e24, lusd_metapool.balances(1)/1e24)
	print("rate: ", lusd_metapool.balances(0) / (lusd_metapool.balances(0) + lusd_metapool.balances(1)))
	print("LUSD priced in USDC: ", lusd_metapool.get_dy_underlying(0,2,1e18))
	withdraw(lusdLpDiff)
	# lost 4790 USDC & LUSD priced at 1.002046

#deploy liquidity, pool gets 80(3pool)/20 ish balanced and remove liquidity
with TemporaryFork():
	lusdLpDiff = deposit()
	# balance lusd metapool
	# lusd_metapool.add_liquidity([8.8 * 1e6 * 1e18, 0], 0, SOPS) # 1 mio USDC
	lusd_metapool.add_liquidity([11.3 * 1e6 * 1e18, 0], 0, SOPS) # 10 mio USDC
	print("rate: ", lusd_metapool.balances(0) / (lusd_metapool.balances(0) + lusd_metapool.balances(1)))
	print("LUSD priced in USDC: ", lusd_metapool.get_dy_underlying(0,2,1e18))
	withdraw(lusdLpDiff)
	# lost 3908 USDC & LUSD priced at 1.005


#deploy liquidity, pool gets 95(3pool)/5 ish balanced and remove liquidity
with TemporaryFork():
	lusdLpDiff = deposit()
	# balance lusd metapool
	# amount3Pool = 42 * 1e6 * 1e18 # 1 mio USDC
	amount3Pool = 40.8 * 1e6 * 1e18 # 10 mio USDC
	threepool_lp.transfer(STRATEGIST, amount3Pool, OPTS)
	lusd_metapool.add_liquidity([0, amount3Pool], 0, SOPS)
	print("rate: ", lusd_metapool.balances(0) / (lusd_metapool.balances(0) + lusd_metapool.balances(1)))
	print("LUSD priced in USDC: ", lusd_metapool.get_dy_underlying(0,2,1e18))
	withdraw(lusdLpDiff)
	# gained 4235 USDC & LUSD priced at 1.114993

	



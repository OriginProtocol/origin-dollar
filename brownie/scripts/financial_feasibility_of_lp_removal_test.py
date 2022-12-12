# The goal of this test is to gauge how high would be the savings if we were to implement a change where
# meta-strategies are able to re-allocate funds without exchanging 3crvLP to stablecoins and back, 
# and would rather keep allocation in 3crv and deposit those back to the strategy

#SETUP
OPTS = {"from":me}
balance = dai.balanceOf(lp_whale)
threepool.remove_liquidity_one_coin(diff_3pool, 0, 0, {"from": lp_whale})
diff = (dai.balanceOf(lp_whale) - balance) / 1e18
print("{:.6f} dai on LP removal".format(diff))

dai = Contract.from_explorer("0x6b175474e89094c44da98b954eedeac495271d0f")
meta_pool = Contract.from_explorer(OUSD_METAPOOL)
threepool_lp = load_contract('threepool_lp', THREEPOOL_LP)

threepool_lp.approve(meta_pool, int(0), OPTS)
threepool_lp.approve(meta_pool, int(1e50), OPTS)
dai.approve(threepool, int(1e50), OPTS)

#meta_pool.add_liquidity([0, 10000*1e18], 0, OPTS)
#meta_pool.remove_liquidity_one_coin(10000*1e18, 1, 0, OPTS)

metapool_LP_to_relocate = 10*1e18

#TEST CASE ONE
#remove from metapool
threePool_balance = threepool_lp.balanceOf(me)
meta_pool.remove_liquidity_one_coin(metapool_LP_to_relocate, 1, 0, OPTS)
threePool_diff = threepool_lp.balanceOf(me) - threePool_balance
print("threePool_diff", threePool_diff)

# remove from 3 pool
dai_balance = dai.balanceOf(me)
threepool.remove_liquidity_one_coin(threePool_diff, 0, 0, OPTS)
dai_diff = (dai.balanceOf(me) - dai_balance)
print("dai_diff", dai_diff)

# add back to 3 pool
threePool_balance_insert = threepool_lp.balanceOf(me)
threepool.add_liquidity([dai_diff, 0, 0], 0, OPTS)
threePool_diff_insert = threepool_lp.balanceOf(me) - threePool_balance_insert
print("threePool_diff_insert", threePool_diff_insert)

# add back to metapool
metapool_balance = meta_pool.balanceOf(me)
meta_pool.add_liquidity([0, threePool_diff_insert], 0, OPTS)
meatapool_diff = meta_pool.balanceOf(me) - metapool_balance
print("meatapool_diff", meatapool_diff)

#TEST CASE TWO
threePool_balance = threepool_lp.balanceOf(me)
meta_pool.remove_liquidity_one_coin(metapool_LP_to_relocate, 1, 0, OPTS)
threePool_diff = threepool_lp.balanceOf(me) - threePool_balance
print("threePool_diff", threePool_diff)

metapool_balance = meta_pool.balanceOf(me)
meta_pool.add_liquidity([0, threePool_diff], 0, OPTS)
meatapool_diff = meta_pool.balanceOf(me) - metapool_balance
print("meatapool_diff", meatapool_diff)
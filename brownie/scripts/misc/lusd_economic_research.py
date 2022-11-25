# block 15937916 : 27.8.2022 3:00 CET: 1042.260392 dai on swap & 1020.712406 dai on removal
# block 15944923 : 11.11.2022 6:15 CET:  1034.048298 dai on swap & 1020.524263 dai on removal
# block 15441622 : 8.30.2022 17:22 CET: 1008.661489 dai on swap & 1018.300099 dai on removal
# block 15420405 : 8.27.2022 8:03 CET:  1035.403256 dai on swap & 1021.210686 dai on removal

from world import *
lusd_pool = Contract.from_explorer("0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA")
lusd = Contract.from_explorer("0x5f98805A4E8be255a32880FDeC7F6728C6568bA0")
dai = Contract.from_explorer("0x6b175474e89094c44da98b954eedeac495271d0f")
threepool_lp = load_contract('threepool_lp', THREEPOOL_LP)

whale = "0x66017d22b0f8556afdd19fc67041899eb65a21bb"
lp_whale = "0xeb31da939878d1d780fdbcc244531c0fb80a2cf3"
lusd.approve(lusd_pool.address, 1e50, {"from":whale})
balance = dai.balanceOf(whale)
lusd_pool.exchange_underlying(0,1,1000*1e18,0,{"from": whale})
diff = (dai.balanceOf(whale) - balance) / 1e18
print("gained {:.6f} dai".format(diff))

balance_3pool = threepool_lp.balanceOf(lp_whale)
lusd_pool.remove_liquidity_one_coin(1000*1e18, 1, 0, {"from": lp_whale})
diff_3pool = (threepool_lp.balanceOf(lp_whale) - balance_3pool)

balance = dai.balanceOf(lp_whale)
threepool.remove_liquidity_one_coin(diff_3pool, 0, 0, {"from": lp_whale})
diff = (dai.balanceOf(lp_whale) - balance) / 1e18
print("gained {:.6f} dai from liquidity removal".format(diff))
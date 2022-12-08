# block 15937916 : 11.10.2022 3:00 CET: 1042.260392 dai diff on swap & 1020.712406 dai on LP removal
# block 15944923 : 11.11.2022 6:15 CET: 1034.048298 dai diff on swap & 1020.524263 dai on LP removal
# block 15441622 : 8.30.2022 17:22 CET: 1008.661489 dai diff on swap & 1018.300099 dai on LP removal
# block 15420405 : 8.27.2022 8:03 CET: 1035.403256 dai diff on swap & 1021.210686 dai on LP removal
# block 14478535 : 3.29.2022 2:52 CET: 1002.805543 dai diff on swap & 1013.438278 dai on LP removal
# block 14058778 : 1.23.2022 0:50 CET: 1002.805543 dai diff on swap & 1013.438278 dai on LP removal
# web3.connect('http://127.0.0.1:8545', 120)



import  brownie
from addresses import *
import json
def load_contract(name, address):
    with open("abi/%s.json" % name, 'r') as f:
        abi = json.load(f)
        return brownie.Contract.from_abi(name, address, abi)

threepool = brownie.Contract.from_abi(
  "ThreePool",
  "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
  [{"name":"TokenExchange","inputs":[{"type":"address","name":"buyer","indexed":True},{"type":"int128","name":"sold_id","indexed":False},{"type":"uint256","name":"tokens_sold","indexed":False},{"type":"int128","name":"bought_id","indexed":False},{"type":"uint256","name":"tokens_bought","indexed":False}],"anonymous":False,"type":"event"},{"name":"AddLiquidity","inputs":[{"type":"address","name":"provider","indexed":True},{"type":"uint256[3]","name":"token_amounts","indexed":False},{"type":"uint256[3]","name":"fees","indexed":False},{"type":"uint256","name":"invariant","indexed":False},{"type":"uint256","name":"token_supply","indexed":False}],"anonymous":False,"type":"event"},{"name":"RemoveLiquidity","inputs":[{"type":"address","name":"provider","indexed":True},{"type":"uint256[3]","name":"token_amounts","indexed":False},{"type":"uint256[3]","name":"fees","indexed":False},{"type":"uint256","name":"token_supply","indexed":False}],"anonymous":False,"type":"event"},{"name":"RemoveLiquidityOne","inputs":[{"type":"address","name":"provider","indexed":True},{"type":"uint256","name":"token_amount","indexed":False},{"type":"uint256","name":"coin_amount","indexed":False}],"anonymous":False,"type":"event"},{"name":"RemoveLiquidityImbalance","inputs":[{"type":"address","name":"provider","indexed":True},{"type":"uint256[3]","name":"token_amounts","indexed":False},{"type":"uint256[3]","name":"fees","indexed":False},{"type":"uint256","name":"invariant","indexed":False},{"type":"uint256","name":"token_supply","indexed":False}],"anonymous":False,"type":"event"},{"name":"CommitNewAdmin","inputs":[{"type":"uint256","name":"deadline","indexed":True},{"type":"address","name":"admin","indexed":True}],"anonymous":False,"type":"event"},{"name":"NewAdmin","inputs":[{"type":"address","name":"admin","indexed":True}],"anonymous":False,"type":"event"},{"name":"CommitNewFee","inputs":[{"type":"uint256","name":"deadline","indexed":True},{"type":"uint256","name":"fee","indexed":False},{"type":"uint256","name":"admin_fee","indexed":False}],"anonymous":False,"type":"event"},{"name":"NewFee","inputs":[{"type":"uint256","name":"fee","indexed":False},{"type":"uint256","name":"admin_fee","indexed":False}],"anonymous":False,"type":"event"},{"name":"RampA","inputs":[{"type":"uint256","name":"old_A","indexed":False},{"type":"uint256","name":"new_A","indexed":False},{"type":"uint256","name":"initial_time","indexed":False},{"type":"uint256","name":"future_time","indexed":False}],"anonymous":False,"type":"event"},{"name":"StopRampA","inputs":[{"type":"uint256","name":"A","indexed":False},{"type":"uint256","name":"t","indexed":False}],"anonymous":False,"type":"event"},{"outputs":[],"inputs":[{"type":"address","name":"_owner"},{"type":"address[3]","name":"_coins"},{"type":"address","name":"_pool_token"},{"type":"uint256","name":"_A"},{"type":"uint256","name":"_fee"},{"type":"uint256","name":"_admin_fee"}],"stateMutability":"nonpayable","type":"constructor"},{"name":"A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":5227},{"name":"get_virtual_price","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":1133537},{"name":"calc_token_amount","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"bool","name":"deposit"}],"stateMutability":"view","type":"function","gas":4508776},{"name":"add_liquidity","outputs":[],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"uint256","name":"min_mint_amount"}],"stateMutability":"nonpayable","type":"function","gas":6954858},{"name":"get_dy","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"stateMutability":"view","type":"function","gas":2673791},{"name":"get_dy_underlying","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"stateMutability":"view","type":"function","gas":2673474},{"name":"exchange","outputs":[],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"},{"type":"uint256","name":"min_dy"}],"stateMutability":"nonpayable","type":"function","gas":2818066},{"name":"remove_liquidity","outputs":[],"inputs":[{"type":"uint256","name":"_amount"},{"type":"uint256[3]","name":"min_amounts"}],"stateMutability":"nonpayable","type":"function","gas":192846},{"name":"remove_liquidity_imbalance","outputs":[],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"uint256","name":"max_burn_amount"}],"stateMutability":"nonpayable","type":"function","gas":6951851},{"name":"calc_withdraw_one_coin","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"_token_amount"},{"type":"int128","name":"i"}],"stateMutability":"view","type":"function","gas":1102},{"name":"remove_liquidity_one_coin","outputs":[],"inputs":[{"type":"uint256","name":"_token_amount"},{"type":"int128","name":"i"},{"type":"uint256","name":"min_amount"}],"stateMutability":"nonpayable","type":"function","gas":4025523},{"name":"ramp_A","outputs":[],"inputs":[{"type":"uint256","name":"_future_A"},{"type":"uint256","name":"_future_time"}],"stateMutability":"nonpayable","type":"function","gas":151919},{"name":"stop_ramp_A","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":148637},{"name":"commit_new_fee","outputs":[],"inputs":[{"type":"uint256","name":"new_fee"},{"type":"uint256","name":"new_admin_fee"}],"stateMutability":"nonpayable","type":"function","gas":110461},{"name":"apply_new_fee","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":97242},{"name":"revert_new_parameters","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21895},{"name":"commit_transfer_ownership","outputs":[],"inputs":[{"type":"address","name":"_owner"}],"stateMutability":"nonpayable","type":"function","gas":74572},{"name":"apply_transfer_ownership","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":60710},{"name":"revert_transfer_ownership","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21985},{"name":"admin_balances","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"i"}],"stateMutability":"view","type":"function","gas":3481},{"name":"withdraw_admin_fees","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21502},{"name":"donate_admin_fees","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":111389},{"name":"kill_me","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":37998},{"name":"unkill_me","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":22135},{"name":"coins","outputs":[{"type":"address","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function","gas":2220},{"name":"balances","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function","gas":2250},{"name":"fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2171},{"name":"admin_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2201},{"name":"owner","outputs":[{"type":"address","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2231},{"name":"initial_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2261},{"name":"future_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2291},{"name":"initial_A_time","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2321},{"name":"future_A_time","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2351},{"name":"admin_actions_deadline","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2381},{"name":"transfer_ownership_deadline","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2411},{"name":"future_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2441},{"name":"future_admin_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2471},{"name":"future_owner","outputs":[{"type":"address","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2501}]
)

# Manipulate pool size
# from world import *
# from metastrategy import * 
# threepool_lp.transfer(whale, 85*1e24, OPTS)
# threepool_lp.approve(lusd_pool.address, 1e50, {"from":whale})
# lusd.approve(lusd_pool.address, 1e50, {"from":whale})
# lusd_pool.add_liquidity([7.9131 * 1e24, 85 * 1e24], 0, {"from":whale})


lusd_pool = Contract.from_explorer("0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA")
lusd = Contract.from_explorer("0x5f98805A4E8be255a32880FDeC7F6728C6568bA0")
dai = Contract.from_explorer("0x6b175474e89094c44da98b954eedeac495271d0f")
threepool_lp = load_contract('threepool_lp', THREEPOOL_LP)

whale = "0x66017d22b0f8556afdd19fc67041899eb65a21bb"
lp_whale = "0xeb31da939878d1d780fdbcc244531c0fb80a2cf3"
lusd.approve(lusd_pool.address, 1e50, {"from":whale})

with TemporaryFork():
	#lp_to_remove = 1000*1e18
	lp_to_remove = 10000*1e18
	#lp_to_remove = 100000*1e18
	#lp_to_remove = 1000000*1e18
	#lp_to_remove = 5000000*1e18

	# do the below line only to manipulate the price of LUSD in the pool
	# 148m TVL
	# 
	# 1014 -> 6.5m
	# 1000 -> 42m
	# 997 -> 87m
	# 993 -> 108m
	# 990 -> 113m
	#
	# 55m TVL
	#
	# 1014 -> 2m
	# 1000 -> 16m
	# 997 -> 33m
	# 993 -> 40m
	# 990 -> 41.7m
	# 978 -> 45m
	#lusd_pool.exchange_underlying(0,1,45*1e24,0,{"from": whale})

	balance = dai.balanceOf(whale)
	lusd_pool.exchange_underlying(0,1,1000*1e18,0,{"from": whale})
	diff = (dai.balanceOf(whale) - balance) / 1e18
	print("{:.6f} dai diff on swap".format(diff))

	balance_3pool = threepool_lp.balanceOf(lp_whale)
	lusd_pool.remove_liquidity_one_coin(lp_to_remove, 1, 0, {"from": lp_whale})
	diff_3pool = (threepool_lp.balanceOf(lp_whale) - balance_3pool)

	balance = dai.balanceOf(lp_whale)
	threepool.remove_liquidity_one_coin(diff_3pool, 0, 0, {"from": lp_whale})
	diff = (dai.balanceOf(lp_whale) - balance) / 1e18
	print("{:.6f} dai on LP removal".format(diff))
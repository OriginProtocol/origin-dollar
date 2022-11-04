# test if flash loan can sandwich attack a strategies withdrawal to stablecoins action.
#
# in this test case the attacker has 300m of each of the 3 stablecoins pre-existing liquidity in
# the pool. Before Vault is able to remove 30m liquidity the attacker removes 300m of that stablecoin
# liquidity. And after the Vault has removed liquidity attacker re-deploys the lifted liquidity
#
# When doing so Vault looses 13.3k in USDC and attacker looses 23.6k in 3CRV. Seems that penalty removing
# only 1 coin from 3pool makes this type of attack not feasible

from metastrategy import *

OPTS_V = {"from": VAULT_PROXY_ADDRESS}

usdc.approve(threepool.address, 1e50, OPTS)
usdt.approve(threepool.address, 0, OPTS)
usdt.approve(threepool.address, 1e50, OPTS)
dai.approve(threepool.address, 1e50, OPTS)
usdc.approve(threepool.address, 1e50, OPTS_V)
usdc.transfer(VAULT_PROXY_ADDRESS, 30e6 * 1e6, OPTS)

with TemporaryFork():
	price_before = threepool.get_virtual_price()
	# attacker deposited 300m of all stablecoins to the pool
	attacker_starting_liquidity = 300e6*1e6
	vault_usdc_liquidity = 30e6*1e6

	tokens_before = threepool_lp.balanceOf(me)
	tokens_before_v = threepool_lp.balanceOf(VAULT_PROXY_ADDRESS)
	threepool.add_liquidity([attacker_starting_liquidity * 1e12, attacker_starting_liquidity, attacker_starting_liquidity], 0, OPTS)
	threepool.add_liquidity([0,vault_usdc_liquidity,0], 0, OPTS_V)
	threepool_diff = threepool_lp.balanceOf(me) - tokens_before
	threepool_diff_vault = threepool_lp.balanceOf(VAULT_PROXY_ADDRESS) - tokens_before_v

	print("3pool LP change attacker", threepool_diff / 1e24, "m")
	print("3pool LP change vault", threepool_diff_vault / 1e24, "m")


	usdc_before_attacker = usdc.balanceOf(me)
	usdc_before_vault = usdc.balanceOf(VAULT_PROXY_ADDRESS)

	# both remove USDC where attacker gets to remove first and after Vault re-deploys the funds
	# attacker re-deploys it as well
	tokens_before = threepool_lp.balanceOf(me)
	threepool.remove_liquidity_one_coin(threepool_diff/3, 1, 0, OPTS)
	threepool.remove_liquidity_one_coin(threepool_diff_vault, 1, 0, OPTS_V)
	usdc_diff_attacker = usdc.balanceOf(me) - usdc_before_attacker
	usdc_diff_vault = usdc.balanceOf(VAULT_PROXY_ADDRESS) - usdc_before_vault
	threepool.add_liquidity([0,usdc_diff_attacker,0], 0, OPTS)
	threepool_diff = threepool_lp.balanceOf(me) - tokens_before

	print("Attacker 3poolLP net difference", (threepool_diff) / 1e18)
	print("Vault USDC net difference", (usdc_diff_vault - vault_usdc_liquidity) / 1e6)

	#Attacker 3poolLP net difference -23676.4334725146
	#Vault USDC net difference -13350.930325

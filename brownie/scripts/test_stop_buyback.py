from world import *

# send a lot of OUSD to buyback
OUSD_BAGS = '0x8e02247d3ee0e6153495c971ffd45aa131f4d7cb'
ousd.transfer(buyback, ousd.balanceOf(OUSD_BAGS), {'from': OUSD_BAGS})

# confirm address is set to 0x0
buyback.uniswapAddr()
preswap_balance = ousd.balanceOf(buyback.address)

def main():
	print("Buyback account has: " + c18(preswap_balance) + " OUSD pre swap")
	buyback.swap({'from': vault_core})
	postswap_balance = ousd.balanceOf(buyback.address)
	print("Buyback account has: " + c18(postswap_balance) + " OUSD post swap")
	if (preswap_balance == postswap_balance):
		print("SUCCESS!")
	else:
		print("FAIL!")

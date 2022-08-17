# 14655959 - problematic frax pool balances
from brownie import Contract

def main():
	threepool_lp = Contract.from_explorer("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490")
	ousd_metapool = Contract.from_explorer("0x87650D7bbfC3A9F10587d7778206671719d9910D")
	frax_metapool = Contract.from_explorer("0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B")
	print("Frax metapool 3crv balance:", frax_metapool.balances(1) / 1e24, "(million)")
	print("Actual 3crv balance:", threepool_lp.balanceOf(frax_metapool) / 1e24, "(million)")
	print("OUSD metapool 3crv balance:", ousd_metapool.balances(1) / 1e24, "(million)")
	print("Actual 3crv balance:", threepool_lp.balanceOf(ousd_metapool) / 1e24, "(million)")
# test harvesting of the strategies
from world import *

def main():
	comp_tx = harvester.harvestAndSwap(comp_strat.address, {'from': brownie.accounts[0]})
	show_transfers(comp_tx)

	cvx_tx = harvester.harvestAndSwap(convex_strat.address, {'from': brownie.accounts[0]})
	show_transfers(cvx_tx)

	aave_tx = harvester.harvestAndSwap(aave_strat.address, {'from': brownie.accounts[0]})
	show_transfers(aave_tx)
# validate SPELL token apy on Curve

from brownie import *

def main():
	gauge_controller = Contract.from_explorer("0x2f50d538606fa9edd2b11e2446beb18c9d5846bb")

	provider = Contract.from_explorer('0x0000000022D53366457F9d5E68Ec105046FC4383')
	pool_info_getter = Contract.from_explorer(provider.get_id_info(0).dict()["addr"])

	mim_pool = Contract.from_explorer("0x5a6A4D54456819380173272A5E8E9B9904BdF41B")
	mim_gauge = Contract.from_explorer(pool_info_getter.get_gauges(mim_pool)[0][0])

	spell_reward_token = mim_gauge.reward_tokens(0)
	tokens_received = mim_gauge.reward_data(spell_reward_token).dict()["rate"] * 31536000 # seconds in a year

	total_supply = mim_gauge.totalSupply()
	dollar_price_of_reward_token = 0.03429647 # from https://www.coingecko.com/en/coins/spell-token
	apy = tokens_received / total_supply * dollar_price_of_reward_token # 0.10344708867350615
	print("Spell rewards token APY {}%".format(round(apy*10000)/100))


	weight = gauge_controller.gauge_relative_weight(mim_gauge)
	inflation = mim_gauge.inflation_rate()
	workingSupply = mim_gauge.working_supply()
	virtualPrice = pool_info_getter.get_virtual_price_from_lp_token(mim_pool)
	rate = inflation * weight * 31536000 / workingSupply * 0.4 / virtualPrice
	base = rate * 4.40
	boost = base * 2.5

	print("Base APY {} Boosted APY {}%".format(round(base*10000)/100, round(boost*10000)/100))
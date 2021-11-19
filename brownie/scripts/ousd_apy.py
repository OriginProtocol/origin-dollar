# validate SPELL token apy on Curve

from brownie import *

def main():
	gauge_controller = Contract.from_explorer("0x2f50d538606fa9edd2b11e2446beb18c9d5846bb")

	provider = Contract.from_explorer('0x0000000022D53366457F9d5E68Ec105046FC4383')
	pool_info_getter = Contract.from_explorer(provider.get_id_info(0).dict()["addr"])

	ousd_pool = Contract.from_explorer("0x87650D7bbfC3A9F10587d7778206671719d9910D")
	ousd_gauge = Contract.from_explorer("0x25f0cE4E2F8dbA112D9b115710AC297F816087CD")

	ogn_reward_token = ousd_gauge.reward_tokens(0)
	tokens_received = ousd_gauge.reward_data(ogn_reward_token).dict()["rate"] * 31536000 # seconds in a year

	total_supply = ousd_gauge.totalSupply()
	dollar_price_of_reward_token = 0.990393 # from https://www.coingecko.com/en/coins/origin-protocol
	apy = tokens_received / total_supply * dollar_price_of_reward_token
	print("Spell rewards token APY {}%".format(round(apy*10000)/100))


	weight = gauge_controller.gauge_relative_weight(ousd_gauge)
	inflation = ousd_gauge.inflation_rate()
	workingSupply = ousd_gauge.working_supply()
	# virtualPrice = pool_info_getter.get_virtual_price_from_lp_token(ousd_pool)
	virtualPrice = 1001170028919302154
	curve_token_price = 4.0 
	rate = inflation * weight * 31536000 / workingSupply * 0.4 / virtualPrice
	base = rate * curve_token_price 
	boost = base * 2.5

	print("Base APY {} Boosted APY {}%".format(round(base*10000)/100, round(boost*10000)/100))
from world_abstract import *

weth = load_contract('weth', WETH_PLUME)
oethp = load_contract('ousd', OETHP)
woeth = load_contract('ERC20', BRIDGED_WOETH_PLUME)
woeth_plume = load_contract('wrapped_ousd', WOETH_PLUME)

plume_strategist = brownie.accounts.at(MULTICHAIN_STRATEGIST, force=True)
from_strategist = {'from':MULTICHAIN_STRATEGIST}

vault_admin = load_contract('vault_admin', OETHP_VAULT_PROXY)
vault_core = load_contract('vault_core', OETHP_VAULT_PROXY)
vault_value_checker = load_contract('vault_value_checker', OETHP_VAULT_VALUE_CHECKER)

woeth_strat = load_contract('woeth_strategy', OETHP_WOETH_STRATEGY)

oethp = load_contract('ERC20', OETHP)

oethpWETHpool = load_contract('maverick_v2_pool', "0x6BbE017bF9F4ffe304F0e0E176927b65445509fa")

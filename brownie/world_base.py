from world_abstract import *

weth = load_contract('ERC20', WETH_BASE)
aero = load_contract('ERC20', AERO_BASE)
oethb = load_contract('ousd', OETHB)

base_strategist = brownie.accounts.at(OETHB_STRATEGIST, force=True)

aero_router = load_contract('aerodrome_swap_router', AERODROME_SWAP_ROUTER_BASE)
aero_pos_man = load_contract('aerodrome_nonfungible_position_manager', AERODROME_POSITION_MANAGER_BASE)
aero_quoter = load_contract('aerodrome_quoter', AERODROME_QUOTER_BASE)
aero_helper = load_contract('aerodrome_slipstream_sugar_helper', AERODROME_SUGAR_HELPER_BASE)
amo_pool = load_contract('aerodrome_slipstream_pool', AERODROME_WETH_OETHB_POOL_BASE)

amo_strat = load_contract('aerodrome_amo_strategy', OETHB_AERODROME_AMO_STRATEGY)
vault_admin = load_contract('vault_admin', OETHB_VAULT_PROXY_ADDRESS)
vault_core = load_contract('vault_core', OETHB_VAULT_PROXY_ADDRESS)
vault_value_checker = load_contract('vault_value_checker', OETHB_VAULT_VALUE_CHECKER)

decimalsMap = {
    AERO_BASE: 18,
    WETH_BASE: 18,
    'human': 0,
}

def scale_amount(from_token, to_token, amount, decimals=0):
    if from_token == to_token:
        return amount

    scaled_amount = (amount * 10 ** decimalsMap[to_token]) / (10 ** decimalsMap[from_token])

    if decimals == 0:
        return int(scaled_amount * 10**6) / 10**6

    return int(scale_amount * 10**decimals) / (10**decimals)
from world_abstract import *

weth = load_contract('ERC20', WETH_BASE)
aero = load_contract('ERC20', AERO_BASE)
oethb = load_contract('ousd', OETHB)

aero_router = load_contract('aerodrome_swap_router', AERODROME_SWAP_ROUTER_BASE)
aero_pos_man = load_contract('aerodrome_nonfungible_position_manager', AERODROME_POSITION_MANAGER_BASE)
aero_helper = load_contract('aerodrome_slipstream_sugar_helper', AERODROME_SUGAR_HELPER_BASE)
amo_pool = load_contract('aerodrome_slipstream_pool', AERODROME_WETH_OETHB_POOL_BASE)

amo_strat = load_contract('aerodrome_amo_strategy', OETHB_AERODROME_AMO_STRATEGY)
vault_admin = load_contract('vault_admin', OETHB_VAULT_PROXY_ADDRESS)
vault_core = load_contract('vault_core', OETHB_VAULT_PROXY_ADDRESS)
vault_value_checker = load_contract('vault_value_checker', OETHB_VAULT_VALUE_CHECKER)
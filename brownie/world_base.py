from world_abstract import *

# (these are not on mainnet yet) SET CORRECT ADDRESS 
AERODROME_AMO_STRATEGY="0xEA24e9Bac006DE9635Ac7fA4D767fFb64FB5645c"
weth = load_contract('ERC20', WETH_BASE)
aero = load_contract('ERC20', AERO_BASE)

aero_router = load_contract('aerodrome_swap_router', AERODROME_SWAP_ROUTER_BASE)
aero_pos_man = load_contract('aerodrome_nonfungible_position_manager', AERODROME_POSITION_MANAGER_BASE)
aero_helper = load_contract('aerodrome_slipstream_sugar_helper', AERODROME_SUGAR_HELPER_BASE)
amo_pool = load_contract('aerodrome_slipstream_pool', AERODROME_WETH_OETHB_POOL_BASE)

amo_strat = load_contract('aerodrome_amo_strategy', AERODROME_AMO_STRATEGY)
vault_admin = load_contract('vault_admin', VAULT_OETHB_PROXY_ADDRESS)
vault_core = load_contract('vault_admin', VAULT_OETHB_PROXY_ADDRESS)
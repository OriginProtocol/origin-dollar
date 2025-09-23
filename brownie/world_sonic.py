from world_abstract import *

ws = load_contract('ws', WS_SONIC)
os = load_contract('ousd', OS)
wos = load_contract('ERC20', WOS)

vault_admin = load_contract('vault_admin', OS_VAULT_PROXY_ADDRESS)
vault_core = load_contract('vault_core', OS_VAULT_PROXY_ADDRESS)
vault_value_checker = load_contract('vault_value_checker', OS_VAULT_VALUE_CHECKER)

swapx_amo_strat = load_contract('swapx_amo_strat', SWAPX_AMO_STRATEGY)
swapx_amo_pool = load_contract('swapx_amo_pool', SWAPX_AMO_POOL)
sonic_staking_strat = load_contract('sonic_staking_strat', SONIC_STAKING_STRATEGY)

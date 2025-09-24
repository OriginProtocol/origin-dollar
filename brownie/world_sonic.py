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

def print_amo_pool_status(description):
    wsPoolBalance = ws.balanceOf(SWAPX_AMO_POOL)
    osPoolBalance = os.balanceOf(SWAPX_AMO_POOL)
    totalPool = wsPoolBalance + osPoolBalance
    price = swapx_amo_pool.getAmountOut(10**18, OS)

    print("SwapX wS/OS Pool ", description)  
    print("Pool wS     ", "{:.2f}".format(wsPoolBalance / 10**18), "{:.2f}".format(wsPoolBalance * 100 / totalPool), "%")
    print("Pool OS     ", "{:.2f}".format(osPoolBalance / 10**18), "{:.2f}".format(osPoolBalance * 100 / totalPool), "%")
    print("Pool Total  ", "{:.2f}".format(totalPool / 10**18), totalPool)
    print("Sell 1000 OS price", "{:.6f}".format(price / 10**18))

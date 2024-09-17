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

dripper = load_contract('dripper', OETHB_DRIPPER)

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

def amo_snapsnot():
    wethPoolBalance = weth.balanceOf(AERODROME_WETH_OETHB_POOL_BASE)
    superOETHbPoolBalance = oethb.balanceOf(AERODROME_WETH_OETHB_POOL_BASE)
    poolTotal = wethPoolBalance + superOETHbPoolBalance

    (wethOwned, oethbOwned) = amo_strat.getPositionPrincipal()
    nonStratWeth = wethPoolBalance - wethOwned
    nonStratOethb = superOETHbPoolBalance - oethbOwned
    stratTotal = wethOwned + oethbOwned 
    othersTotal = nonStratWeth + nonStratOethb

    liquidityGross = amo_pool.ticks(amo_strat.lowerTick())[0]
    wethInTickTotal, oethbInTickTotal =  aero_helper.getAmountsForLiquidity(
        amo_pool.slot0()[0], #sqrtPriceX96
        amo_strat.sqrtRatioX96TickLower(), 
        amo_strat.sqrtRatioX96TickHigher(),
        liquidityGross
    )
    totalTickTokens = wethInTickTotal + oethbInTickTotal

    print("------------------ AMO Strategy LP position ------------------")
    print("           ", leading_whitespace("Amount"), leading_whitespace("Percentage"))
    print("WETH       ", c18(wethOwned), pcts(wethOwned * 100 / stratTotal))
    print("superOETH  ", c18(oethbOwned), pcts(oethbOwned * 100 / stratTotal))
    print("Total      ", c18(stratTotal), pcts(100))
    print("Dominance  ", pcts(stratTotal / totalTickTokens * 100))


    print("------------------ Others LP position ------------------------")
    print("           ", leading_whitespace("Amount"))
    print("WETH       ", c18(nonStratWeth))
    print("superOETH  ", c18(nonStratOethb))
    print("Total      ", c18(othersTotal), pcts(100))

    # Maybe un-comment if you deem it useful    
    # print("--------------------- Pool stats -----------------------------")
    # print("           ", leading_whitespace("Amount"), leading_whitespace("Percentage"))
    # print("WETH       ", c18(wethPoolBalance), pcts(wethPoolBalance * 100 / total))
    # print("superOETH  ", c18(superOETHbPoolBalance), pcts(superOETHbPoolBalance * 100 / total))
    # print("Total      ", c18(poolTotal), pcts(100))
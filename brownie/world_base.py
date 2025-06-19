from world_abstract import *

weth = load_contract('weth', WETH_BASE)
aero = load_contract('ERC20', AERO_BASE)
usdc = load_contract('ERC20', USDC_BASE)
oethb = load_contract('ousd', OETHB)
woeth = load_contract('ERC20', BRIDGED_WOETH_BASE)
woeth_base = load_contract('wrapped_ousd', WOETH_BASE)
veaero = load_contract('veaero', VEAERO_BASE)

base_old_strategist = brownie.accounts.at(OETHB_STRATEGIST, force=True)
base_strategist = brownie.accounts.at(OETHB_MULTICHAIN_STRATEGIST, force=True)
base_locker = brownie.accounts.at(BASE_LOCKER, force=True)
from_old_strategist = {'from':OETHB_STRATEGIST}
from_strategist = {'from':OETHB_MULTICHAIN_STRATEGIST}
from_treasury = { 'from': OETHB_TREASURY }
from_base_locker = { 'from': BASE_LOCKER }

aero_router = load_contract('aerodrome_swap_router', AERODROME_SWAP_ROUTER_BASE)
aero_router2 = load_contract('aerodrome_v2_router', AERODROME_ROUTER2_BASE)
aero_pos_man = load_contract('aerodrome_nonfungible_position_manager', AERODROME_POSITION_MANAGER_BASE)
aero_quoter = load_contract('aerodrome_quoter', AERODROME_QUOTER_BASE)
aero_helper = load_contract('aerodrome_slipstream_sugar_helper', AERODROME_SUGAR_HELPER_BASE)
amo_pool = load_contract('aerodrome_slipstream_pool', AERODROME_WETH_OETHB_POOL_BASE)
curve_pool = load_contract('curve_pool_base', CURVE_POOL_BASE)

aerodrome_voter = load_contract('aerodrome_voter', AERO_VOTER_BASE)

ogn_pool = load_contract('aerodrome_ogn_pool', AERODROME_OGN_OETHB_POOL_BASE)
oethb_weth_bribe = load_contract('aero_bribes', OETHB_WETH_BRIBE_CONTRACT)

amo_strat = load_contract('aerodrome_amo_strategy', OETHB_AERODROME_AMO_STRATEGY)
vault_admin = load_contract('vault_admin', OETHB_VAULT_PROXY_ADDRESS)
vault_core = load_contract('vault_core', OETHB_VAULT_PROXY_ADDRESS)
vault_value_checker = load_contract('vault_value_checker', OETHB_VAULT_VALUE_CHECKER)

woeth_strat = load_contract('woeth_strategy', OETHB_WOETH_STRATEGY)

dripper = load_contract('oethb_dripper', OETHB_DRIPPER)

harvester = load_contract('oethb_harvester', OETHB_HARVESTER)

ccip_router = load_contract('ccip_router', BASE_CCIP_ROUTER)

zapper = load_contract('oethb_zapper', OETHB_ZAPPER)

decimalsMap = {
    AERO_BASE: 18,
    WETH_BASE: 18,
    USDC_BASE: 6,
    OETHB: 18,
    'human': 0,
}

def scale_amount(from_token, to_token, amount, decimals=0):
    if from_token == to_token:
        return amount

    scaled_amount = (amount * 10 ** decimalsMap[to_token]) / (10 ** decimalsMap[from_token])

    if decimals == 0:
        return int(scaled_amount * 10**6) / 10**6

    return int(scale_amount * 10**decimals) / (10**decimals)

def get_tick_liquidity(tick):
    liquidityGross = amo_pool.ticks(tick)[0]
    wethInTickTotal, oethbInTickTotal =  aero_helper.getAmountsForLiquidity(
        amo_pool.slot0()[0], #sqrtPriceX96
        aero_helper.getSqrtRatioAtTick(tick), 
        aero_helper.getSqrtRatioAtTick(tick + 1),
        liquidityGross
    )
    print("------------------")
    print("WETH       ", c18(wethInTickTotal))
    print("OETHB      ", c18(oethbInTickTotal))
    print("------------------")

def amo_snapshot():
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
    if stratTotal > 0:  
      print("WETH       ", c18(wethOwned), pcts(wethOwned * 100 / stratTotal))
      print("superOETH  ", c18(oethbOwned), pcts(oethbOwned * 100 / stratTotal))
      print("Total      ", c18(stratTotal), pcts(100))
    if totalTickTokens > 0:
      print("Dominance  ", pcts(stratTotal / totalTickTokens * 100))
    else:
      print("Dominance  ", pcts(0))


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
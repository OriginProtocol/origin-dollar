from world_base import *
import time

from_strategist = {'from':OETHB_STRATEGIST}

# From the pool contract
# Ref: https://basescan.org/address/0x82321f3BEB69f503380D6B233857d5C43562e2D0#readContract
AERO_WETH_TICKSPACING = 200 

SLIPPAGE = 2.0 # 2%

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
    
def harvest_and_swap():
    txs = []

    # Collect AERO from the strategy
    txs.append(
        amo_strat.collectRewardTokens(from_strategist)
    )

    # Figure out how AERO the strategist has
    balance = aero.balanceOf(OETHB_STRATEGIST, from_strategist)

    # Approve the swap router to move it
    txs.append(
        aero.approve(AERODROME_SWAP_ROUTER_BASE, balance, from_strategist)
    )

    # Get a quote
    (amountOut, gasEstimate, ticksCrossed, sqrtPriceX96After) = aero_quoter.quoteExactInputSingle.call(
        [
            AERO_BASE, # from token
            WETH_BASE, # to token
            balance, # balance
            AERO_WETH_TICKSPACING, # tickSpacing
            0, # sqrtPriceLimitX96
        ],
        from_strategist
    )

    # Factor in slippage
    minAmountOut = ((amountOut * (100 - SLIPPAGE)) / 100)

    # TODO: Should a padding of +/- 1 be added here?
    sqrtPriceLimitX96 = sqrtPriceX96After


    print("\n--------------------")
    print("###### AERO > WETH: ")
    print("--------------------")
    print("AERO available:                          {:.6f}".format(scale_amount(AERO_BASE, 'human', balance)))
    print("Slippage:                                {:.2f}%".format(SLIPPAGE))
    print("Min expected tokens:                     {:.6f}".format(scale_amount(WETH_BASE, 'human', minAmountOut)))
    print("--------- Quote ----------")
    print("Amount out:                              {:.6f}".format(scale_amount(WETH_BASE, 'human', amountOut)))
    print("Ticks crossed:                           {:.0f}".format(ticksCrossed))
    print("Price after (x96):                       {:.0f}".format(sqrtPriceX96After))


    # Build the swap tx
    params = [
        AERO_BASE, # from token
        WETH_BASE, # to token
        AERO_WETH_TICKSPACING, # tickSpacing
        OETHB_STRATEGIST, # recipient

        # Setting deadline to zero doesn't disable it.
        # We need to set a timestamp in future. It's not possible 
        # to get the timestamp of the block this will be mined in.
        # So, it adds 2 hours to the current time as deadline
        time.time() + (2 * 60 * 60), # deadline

        balance, # amountIn
        minAmountOut, # minAmountOut
        0 # sqrtPriceLimitX96
    ]

    # Do the swap
    txs.append(
        aero_router.exactInputSingle(
            params,
            from_strategist
        )
    )

    print(to_gnosis_json(txs, OETHB_STRATEGIST, "8453"))


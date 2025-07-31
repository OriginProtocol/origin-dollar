from world_base import *
import time

# From the pool contract
# Ref: https://basescan.org/address/0x82321f3BEB69f503380D6B233857d5C43562e2D0#readContract
AERO_WETH_TICKSPACING = 200 

SLIPPAGE = 1.0 # 1%

def swap_params_multiple(amount_in, path, recipient=OETHB_STRATEGIST, to_token=WETH_BASE, to_token_label="WETH"):
    # Get a quote
    (amountOut, gasEstimate, ticksCrossed, sqrtPriceX96After) = aero_quoter.quoteExactInput.call(
        path,
        amount_in,
        from_strategist
    )

    # Factor in slippage
    minAmountOut = ((amountOut * (100 - SLIPPAGE)) / 100)

    # TODO: Should a padding of +/- 1 be added here?
    sqrtPriceLimitX96 = sqrtPriceX96After


    print("\n--------------------")
    print("###### AERO > {}: ".format(to_token_label))
    print("--------------------")
    print("AERO to use:                             {:.6f}".format(scale_amount(AERO_BASE, 'human', amount_in)))
    print("Slippage:                                {:.2f}%".format(SLIPPAGE))
    print("Min expected tokens:                     {:.6f}".format(scale_amount(to_token, 'human', minAmountOut)))
    print("--------- Quote ----------")
    print("Amount out:                              {:.6f}".format(scale_amount(to_token, 'human', amountOut)))


    # Build the swap tx
    params = [
        path,
        recipient,

        # Setting deadline to zero doesn't disable it.
        # We need to set a timestamp in future. It's not possible 
        # to get the timestamp of the block this will be mined in.
        # So, it adds 2 hours to the current time as deadline
        time.time() + (2 * 60 * 60), # deadline

        amount_in, # amountIn
        minAmountOut, # minAmountOut
    ]

    return params

def swap_params(amount_in, recipient=OETHB_STRATEGIST, to_token=WETH_BASE, tick_spacing=AERO_WETH_TICKSPACING):
    # Get a quote
    (amountOut, gasEstimate, ticksCrossed, sqrtPriceX96After) = aero_quoter.quoteExactInputSingle.call(
        [
            AERO_BASE, # from token
            to_token, # to token
            amount_in, # amount_in
            tick_spacing, # tickSpacing
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
    print("AERO to use:                             {:.6f}".format(scale_amount(AERO_BASE, 'human', amount_in)))
    print("Slippage:                                {:.2f}%".format(SLIPPAGE))
    print("Min expected tokens:                     {:.6f}".format(scale_amount(to_token, 'human', minAmountOut)))
    print("--------- Quote ----------")
    print("Amount out:                              {:.6f}".format(scale_amount(to_token, 'human', amountOut)))
    print("Ticks crossed:                           {:.0f}".format(ticksCrossed))
    print("Price after (x96):                       {:.0f}".format(sqrtPriceX96After))


    # Build the swap tx
    params = [
        AERO_BASE, # from token
        to_token, # to token
        tick_spacing, # tickSpacing
        recipient, # recipient

        # Setting deadline to zero doesn't disable it.
        # We need to set a timestamp in future. It's not possible 
        # to get the timestamp of the block this will be mined in.
        # So, it adds 2 hours to the current time as deadline
        time.time() + (2 * 60 * 60), # deadline

        amount_in, # amountIn
        minAmountOut, # minAmountOut
        0 # sqrtPriceLimitX96
    ]

    return params
    
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

    # Do the swap
    txs.append(
        aero_router.exactInputSingle(
            swap_params(balance),
            from_strategist
        )
    )

    print(to_gnosis_json(txs, OETHB_STRATEGIST, "8453"))


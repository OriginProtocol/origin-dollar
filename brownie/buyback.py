from world import *
from prices import *

def build_buyback_tx(otoken_address, amount, max_ogv_slippage=1.0, max_cvx_slippage=2.0):
    buyback = oeth_buyback if otoken_address == OETH else ousd_buyback
    otoken = oeth if otoken_address == OETH else ousd
    otoken_label = "OETH" if otoken_address == OETH else "OUSD"

    amount_for_ogv = int(amount / 2)
    amount_for_cvx = amount - amount_for_ogv

    available_otokens = otoken.balanceOf(buyback.address)

    ogv_quote, ogv_quote_wo_slippage, expected_ogv_slippage, ogv_price_impact = get_token_quote(otoken_address, OGV, amount_for_ogv)
    cvx_quote, cvx_quote_wo_slippage, expected_cvx_slippage, cvx_price_impact = get_token_quote(otoken_address, CVX, amount_for_cvx)

    # Compute min tokens
    min_ogv = int(ogv_quote_wo_slippage * (100 - max_ogv_slippage) / 100)
    min_cvx = int(cvx_quote_wo_slippage * (100 - max_cvx_slippage) / 100)

    print("\n--------------------")
    print("###### {} Buyback:".format(otoken_label))
    print("--------------------")

    print("Balance in contract:             {}".format(c18(available_otokens, False)))
    print("\nTo be swapped to OGV:            {}".format(c18(amount_for_ogv, False)))
    print("Expected OGV:                    {}".format(c18(ogv_quote, False)))
    print("Minimum OGV:                     {}".format(c18(min_ogv, False)))
    print("Expected OGV Slippage:           {}".format(pcts(expected_ogv_slippage)))
    print("Expected OGV Price Impact:       {}".format(pcts(ogv_price_impact)))
    print("\nTo be swapped to CVX:            {}".format(c18(amount_for_cvx, False)))
    print("Expected CVX:                    {}".format(c18(cvx_quote, False)))
    print("Minimum CVX:                     {}".format(c18(min_cvx, False)))
    print("Expected CVX Slippage:           {}".format(pcts(expected_cvx_slippage)))
    print("Expected CVX Price Impact:       {}".format(pcts(cvx_price_impact)))

    higher_ogv_slippage = expected_ogv_slippage > max_ogv_slippage
    higher_cvx_slippage = expected_cvx_slippage > max_cvx_slippage

    if higher_cvx_slippage and higher_ogv_slippage:
        raise Exception("Slippage is too high at the moment for CVX and OGV")
    elif higher_cvx_slippage:
        raise Exception("Slippage is too high at the moment for CVX")
    elif higher_ogv_slippage:
        raise Exception("Slippage is too high at the moment for OGV")

    tx = buyback.swap(amount, min_ogv, min_cvx, std)
    return tx

def get_token_quote(otoken, to_token, amount):
    min_amount = 10 * 1e18 if otoken == OUSD else 0.01 * 1e18

    buyback = oeth_buyback if otoken == OETH else ousd_buyback
    path = buyback.ogvPath() if to_token == OGV else buyback.cvxPath()

    uni_quote, prices_before, _, _ = get_uniswap_v3_quote(path, min_amount)
    price_before = parse_uniswap_x96_price(prices_before[len(prices_before) - 1])

    no_slippage_quote = max([
        get_coingecko_quote(otoken, to_token, min_amount),
        get_cmc_quote(otoken, to_token, min_amount),
        uni_quote
    ])
    no_slippage_quote = amount * no_slippage_quote / min_amount

    actual_quote, prices_after, _, _ = get_uniswap_v3_quote(path, amount)

    # WETH<>to_token price impact
    price_after = parse_uniswap_x96_price(prices_after[len(prices_after) - 1])
    price_impact = 100 * ((price_after - price_before) / price_before)

    slippage = 100 * (no_slippage_quote - actual_quote) / actual_quote

    return (actual_quote, no_slippage_quote, slippage, price_impact)

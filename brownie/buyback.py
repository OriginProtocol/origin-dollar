from world import *
from prices import *
from oneinch import *

from brownie.convert.datatypes import HexString
import eth_abi


router_1inch = load_contract('router_1inch_v5', ROUTER_1INCH_V5)
SWAP_SELECTOR = "0x12aa3caf" #swap(address,(address,address,address,address,uint256,uint256,uint256),bytes,bytes)
UNISWAP_SELECTOR = "0xf78dc253" #unoswapTo(address,address,uint256,uint256,uint256[])
UNISWAPV3_SWAP_TO_SELECTOR = "0xbc80f1a8" #uniswapV3SwapTo(address,uint256,uint256,uint256[])

def get_balance_splits(otoken_address):
    buyback = oeth_buyback if otoken_address == OETH else ousd_buyback
    otoken = oeth if otoken_address == OETH else ousd

    ogv_balance = buyback.balanceForOGV()
    cvx_balance = buyback.balanceForCVX()

    cvx_share_bps = buyback.cvxShareBps()

    otoken_balance = otoken.balanceOf(buyback.address)

    available_balance = otoken_balance - ogv_balance - cvx_balance

    if available_balance > 0:
        cvx_share = int((available_balance * cvx_share_bps) / 10**4)
        cvx_balance += cvx_share
        ogv_balance += (available_balance - cvx_share)

    # Subtracts 0.01 to account for any rounding issues
    return ogv_balance - 10**16, cvx_balance - 10**16

def build_1inch_buyback_tx(otoken_address, buyback_token, amount, max_slippage=1.0):
    buyback = oeth_buyback if otoken_address == OETH else ousd_buyback
    otoken = oeth if otoken_address == OETH else ousd
    otoken_label = "OETH" if otoken_address == OETH else "OUSD"

    buyback_token_label = "OGV" if buyback_token == OGV else "CVX"

    min_amount = 1 * 10**18 if otoken_address == OETH else 1000 * 10**18

    # Quote of 1 OToken to compute slippage
    quote_min_amount_price = get_1inch_quote(otoken_address, buyback_token, min_amount)
    quote_no_slippage = (amount * quote_min_amount_price) / min_amount

    min_expected = int((quote_no_slippage * (100 - max_slippage)) / 100)

    # Quote of total amount
    quote_full_amount = get_1inch_quote(otoken_address, buyback_token, amount)

    if quote_no_slippage < quote_full_amount:
        quote_no_slippage = quote_full_amount

    # Compute slippage
    actual_slippage = (quote_no_slippage - quote_full_amount) / quote_full_amount

    print("\n--------------------")
    print("###### {} <> {} Buyback: ".format(otoken_label, buyback_token_label))
    print("--------------------")
    print("{} amount:                               {:.6f}".format(otoken_label, scale_amount(otoken_address, 'human', amount)))
    print("Min expected tokens:                     {:.6f}".format(scale_amount(buyback_token, 'human', min_expected)))
    print("--------------------")
    print("1Inch expected tokens (no slippage):     {:.6f}".format(scale_amount(buyback_token, 'human', quote_no_slippage)))
    print("1Inch token quote:                       {:.6f}".format(scale_amount(buyback_token, 'human', quote_full_amount)))
    print("-------- Slippage --------")
    print("Current market Slippage:                 {:.6f}%".format(actual_slippage * 100))
    print("Transaction Slippage:                    {:.6f}%".format(max_slippage))
    print("Slippage diff:                           {:.6f}%".format(max_slippage - actual_slippage * 100))

    if (abs(actual_slippage * 100) > max_slippage):
        error = "Slippage larger than expected: {:.6f}%".format(actual_slippage * 100)
        print('\033[91m' + error + '\033[0m')
        raise Exception(error)

    result = get_1inch_swap_data(
        from_token=otoken_address.lower(),
        to_token=buyback_token.lower(),
        swap_amount=amount,
        slippage=max_slippage,
        from_address=SWAPPER_1INCH.lower(),
        to_address=buyback.address.lower(),
    )

    input_decoded = router_1inch.decode_input(result.input)

    selector = result.input[:10]
    data = '0x'
    # Swap selector
    if selector == SWAP_SELECTOR:
        data += eth_abi.encode_abi(['bytes4', 'address', 'bytes'], [HexString(selector, "bytes4"), input_decoded[1][0], input_decoded[1][3]]).hex()
    elif selector == UNISWAP_SELECTOR or selector == UNISWAPV3_SWAP_TO_SELECTOR:
        data += eth_abi.encode_abi(['bytes4', 'uint256[]'], [HexString(selector, "bytes4"), input_decoded[1][3]]).hex()

    else: 
        raise Exception("Unrecognized 1Inch swap selector {}".format(selector))

    if buyback_token == OGV:
        return buyback.swapForOGV(
            amount,
            min_expected,
            data,
            std
        )
    elif buyback_token == CVX:
        return buyback.swapForCVX(
            amount,
            min_expected,
            data,
            std
        )
    else:
        raise Exception("Invalid buyback token")

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

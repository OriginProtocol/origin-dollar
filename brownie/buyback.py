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

    ogn_balance = buyback.balanceForOGN()
    cvx_balance = buyback.balanceForCVX()

    cvx_share_bps = buyback.cvxShareBps()

    otoken_balance = otoken.balanceOf(buyback.address)

    available_balance = otoken_balance - ogn_balance - cvx_balance

    if available_balance > 0:
        cvx_share = int((available_balance * cvx_share_bps) / 10**4)
        cvx_balance += cvx_share
        ogn_balance += (available_balance - cvx_share)

    # Subtracts 0.01 to account for any rounding issues
    return ogn_balance - 10**16, cvx_balance - 10**16

def build_1inch_buyback_tx(otoken_address, buyback_token, amount, max_slippage=1.0):
    buyback = oeth_buyback if otoken_address == OETH else ousd_buyback
    otoken = oeth if otoken_address == OETH else ousd
    otoken_label = "OETH" if otoken_address == OETH else "OUSD"

    buyback_token_label = "OGN" if buyback_token == OGN else "CVX"

    # Temporary hack since large OGN swaps fail on 1inch fusion as of now
    # protocols = "UNISWAP,UNISWAP_V3" if buyback_token == OGN else ""
    protocols = ""

    # Get price of the token pair and compute amount without slippage
    quote_no_slippage = int((amount * get_1inch_price(otoken_address, buyback_token)) / (10**decimalsMap[buyback_token]))

    min_expected = int((quote_no_slippage * (100 - max_slippage)) / 100)

    # Quote of total amount
    quote_full_amount = get_1inch_quote(otoken_address, buyback_token, amount, protocols)

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
        protocols=protocols
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
    
    print(buyback.address, amount, min_expected, data)

    if buyback_token == OGN:
        return buyback.swapForOGN(
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

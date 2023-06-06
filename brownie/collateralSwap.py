from brownie import Contract
from brownie.convert.datatypes import HexString
from contextlib import redirect_stdout, contextmanager
import os
import io
import requests
import eth_abi

from world import *

COINMARKETCAP_API_KEY = os.getenv('CMC_API_KEY')
OETH_ORACLE_ROUTER_ADDRESS = vault_oeth_admin.priceProvider()
oeth_oracle_router = load_contract('oracle_router_v2', OETH_ORACLE_ROUTER_ADDRESS)
swapper_address = SWAPPER_1INCH
vault_core_w_swap_collateral = load_contract('vault_core_w_swap_collateral', VAULT_OETH_PROXY_ADDRESS)
# what is the allowed price deviation between 1inch, oracles & coingecko and coinmarketcap
# 2 = 2%
MAX_PRICE_DEVIATION = 2

console_colors = {}
console_colors["ENDC"] = '\033[0m'
console_colors["FAIL"] = '\033[91m'
console_colors["WARNING"] = '\033[93m'
console_colors["OKGREEN"] = '\033[92m'
console_colors["OKCYAN"] = '\033[96m'


@contextmanager
def silent_tx():
    """
    Hide std out transaction information printing.

    ETH brownie does not currently have a way to silence transaction details.
    """
    f = io.StringIO()
    with redirect_stdout(f):
        yield


def get_1inch_quote(from_token, to_token, from_amount):
    req = requests.get('https://api.1inch.io/v5.0/1/quote', params={
        'fromTokenAddress': from_token,
        'toTokenAddress': to_token,
        'amount': str(from_amount)
    }, headers={
        'accept': 'application/json'
    })

    if req.status_code != 200:
        print(req.json())
        raise Exception("Error accessing 1inch api")

    result = req.json()
    return int(result['toTokenAmount'])

# get quote from Coinmarketcap
def get_cmc_quote(from_token, to_token, from_amount):
    idMap = {
        WETH: 2396,
        RETH: 15060,
        STETH: 8085,
        FRXETH: 23225,
        SFRXETH: 23177,
        CBETH: 21535
    }


    req = requests.get('https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest', params={
        'id': idMap[from_token],
        'convert_id': idMap[to_token]
    }, headers={
        'accept': 'application/json',
        'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY
    })

    if req.status_code != 200:
        print(req.json())
        raise Exception("Error accessing 1inch api")

    result = req.json()

    return result["data"][str(idMap[from_token])]["quote"][str(idMap[to_token])]["price"] * from_amount


def get_coingecko_quote(from_token, to_token, from_amount):
    idMap = {
        WETH: 'weth',
        RETH: 'rocket-pool-eth',
        STETH: 'staked-ether',
        FRXETH: 'frax-ether',
        SFRXETH: 'staked-frax-ether',
        CBETH: 'coinbase-wrapped-staked-eth'
    }

    # to_eth bool: when true the ticker returns TOKEN/ETH price and
    # when false it returns ETH/TOKEN price
    def get_price(token, to_eth):
        req = requests.get('https://api.coingecko.com/api/v3/simple/price', params={
            'ids': idMap[token],
            'vs_currencies': 'eth'
        }, headers={
            'accept': 'application/json'
        })

        if req.status_code != 200:
            print(req.json())
            raise Exception("Error accessing 1inch api")

        result = req.json()
        price = float(result[idMap[token]]['eth'])
        price = price if to_eth else 1 / price
        return int(price * 10**18)

    return get_price(from_token, True) * get_price(to_token, False) / 1e18 * from_amount / 1e18

def print_out_protocols_used(protocols):
    asset_map = {
        '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' : 'WETH',
        '0xae7ab96520de3a18e5e111b5eaab095312d7fe84' : 'STETH',
        '0xae78736cd615f374d3085123a210448e74fc6393' : 'RETH',
        '0x5e8422345238f34275888049021821e8e08caa1f' : 'FRXETH',
        '0xac3e018457b222d93114458476f3e3416abbe38f' : 'SFRXETH',
        '0xbe9895146f7af43049ca1c1ae358b0541ea49704' : 'CBETH',
        '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0' : 'WSTETH',
        '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : 'ETH'
    }

    print("------- Swap path used -------")
    print("")

    for protocol_step in protocols:
        for swap_set in protocol_step:
            for swap in swap_set:
                print("name: {} {} {} \t {}->{} share: {}{:.1f}%{}".format(console_colors['OKGREEN'], swap['name'], console_colors['ENDC'], asset_map[swap['fromTokenAddress']], asset_map[swap['toTokenAddress']], console_colors['OKCYAN'], swap['part'], console_colors['ENDC']))
            print("----")
        print("----------------------------------")



def get_1inch_swap(from_token, to_token, from_amount, slippage, allowPartialFill, min_expected_amount):
    router_1inch = load_contract('router_1inch_v5', ROUTER_1INCH_V5)
    SWAP_SELECTOR = "0x12aa3caf" #swap(address,(address,address,address,address,uint256,uint256,uint256),bytes,bytes)
    UNISWAP_SELECTOR = "0x0502b1c5" #unoswap(address,uint256,uint256,uint256[])
    UNISWAPV3_SELECTOR = "0xbc80f1a8" #uniswapV3SwapTo(address,uint256,uint256,uint256[])


    req = requests.get('https://api.1inch.io/v5.0/1/swap', params={
        'fromTokenAddress': from_token,
        'fromAddress': swapper_address,
        'toTokenAddress': to_token,
        'amount': str(from_amount),
        'allowPartialFill': allowPartialFill,
        'disableEstimate': 'true',
        'slippage': slippage
    }, headers={
        'accept': 'application/json'
    })

    if req.status_code != 200:
        print(req.json())
        raise Exception("Error calling 1inch api")

    result = req.json()
    print_out_protocols_used(result['protocols'])
    input_decoded = router_1inch.decode_input(result['tx']['data'])

    selector = result['tx']['data'][:10]
    data = '0x'
    # Swap selector
    if selector == SWAP_SELECTOR:
        data += eth_abi.encode_abi(['bytes4', 'address', 'bytes'], [HexString(selector, "bytes4"), input_decoded[1][0], input_decoded[1][3]]).hex()
    elif selector == UNISWAP_SELECTOR or selector == UNISWAPV3_SELECTOR:
        data += eth_abi.encode_abi(['bytes4', 'uint256[]'], [HexString(selector, "bytes4"), input_decoded[1][3]]).hex()

    else: 
        raise Exception("Unrecognized 1Inch swap selector")

    swap_collateral_data = vault_core_w_swap_collateral.swapCollateral.encode_input(
        result['fromToken']['address'],
        result['toToken']['address'],
        result['fromTokenAmount'],
        min_expected_amount,
        data
    )

    # # TEST THE TX on the Vault
    # accounts[0].transfer(STRATEGIST, "10 ether")
    # tx1 = web3.eth.sendTransaction({
    #     "from": STRATEGIST,
    #     "to": VAULT_OETH_PROXY_ADDRESS,
    #     "value": 0,
    #     "gas": 2001000,
    #     "data": swap_collateral_data,
    #     "gasPrice": 123
    # })

    print("-------- Transaction --------")
    print("Execute the swap transaction on the Vault")
    print("to: {}".format(VAULT_OETH_PROXY_ADDRESS))
    print("data: {}".format(swap_collateral_data))
    print("")

# using oracle router calculate what the expected `toTokenAmount` should be
# this function fails if Oracle data is too stale    
def get_oracle_router_quote(from_token, to_token, from_amount):
    # Oracles communicate the price of token to ETH so to derive the the price
    # of one token to another we should multiply 2 oracle prices: 
    # X_TOKEN/ETH * ETH/Y_TOKEN to get the X_TOKEN/Y_TOKEN oracle price.
    # 
    # To get to ETH/Y_TOKEN price we just use 1 / (Y_TOKEN/ETH)
    from_price = oeth_oracle_router.price(from_token)
    to_price = 10**18 / oeth_oracle_router.price(to_token)

    return from_price * to_price * from_amount / 10**18


# create a swap transaction
# params: 
#   - from_token -> address of token to swap
#   - to_token -> address of token to swap to
#   - from_amount -> amount of token 1 to swap
#   - max_slippage -> allowed slippage when swapping expressed in percentage points
#                 2 = 2%
#   - partial_fill -> are partial fills allowed
def build_swap_tx(from_token, to_token, from_amount, max_slippage, allow_partial_fill):
    if COINMARKETCAP_API_KEY is None:
        raise Exception("Set coinmarketcap api key by setting CMC_API_KEY variable. Free plan key will suffice: https://coinmarketcap.com/api/pricing/")

    min_slippage_amount = 10**18
    quote_1inch = get_1inch_quote(from_token, to_token, from_amount)
    quote_1inch_min_swap_amount_price = get_1inch_quote(from_token, to_token, min_slippage_amount)
    quote_1inch_min_swap_amount = quote_1inch_min_swap_amount_price / min_slippage_amount * from_amount
    quote_oracles = get_oracle_router_quote(from_token, to_token, from_amount)
    quote_coingecko = get_coingecko_quote(from_token, to_token, from_amount)
    quote_cmc = get_cmc_quote(from_token, to_token, from_amount)

    # subtract the max slippage from minimum slippage query
    min_tokens_with_slippage = quote_1inch_min_swap_amount_price * (100 - max_slippage) / 100 * from_amount / 1e18
    coingecko_to_1inch_diff = (quote_1inch - quote_coingecko) / quote_1inch
    oracle_to_1inch_diff = (quote_1inch - quote_oracles) / quote_1inch
    cmc_to_1inch_diff = (quote_1inch - quote_cmc) / quote_1inch

    actual_slippage = (quote_1inch_min_swap_amount - quote_1inch) / quote_1inch

    print("------ Price Quotes ------")
    print("1Inch expected tokens:                   {:.6f}".format(quote_1inch / 10**18))
    print("1Inch expected tokens (no slippage):     {:.6f}".format(quote_1inch_min_swap_amount / 10**18))
    print("Oracle expected tokens:                  {:.6f}".format(quote_oracles / 10**18))
    print("Coingecko expected tokens:               {:.6f}".format(quote_coingecko / 10**18))
    print("CoinmarketCap expected tokens:           {:.6f}".format(quote_cmc / 10**18))
    print("Tokens expected (with {:.2f}% slippage)    {:.6f}".format(max_slippage, min_tokens_with_slippage / 10**18))
    print("")
    print("------ Price Diffs -------")
    print("1Inch to Oracle Difference:              {:.6f}%".format(oracle_to_1inch_diff * 100))
    print("1Inch to Coingecko Difference:           {:.6f}%".format(coingecko_to_1inch_diff * 100))
    print("1Inch to CoinmarketCap Difference:       {:.6f}%".format(cmc_to_1inch_diff * 100))
    print("")
    print("-------- Slippage --------")
    print("Current market Slippage:                 {:.6f}%".format(actual_slippage * 100))
    print("Transaction Slippage:                    {:.6f}%".format(max_slippage))
    print("Slippage diff:                           {:.6f}%".format(max_slippage - actual_slippage * 100))
    print("")

    if (abs(actual_slippage * 100) > max_slippage):
        error = "Slippage larger than expected: {:.6f}%".format(actual_slippage * 100)
        print(console_colors["FAIL"] + error + console_colors["ENDC"])
        raise Exception(error)

    for protocol, price_diff in {
            "Oracle": oracle_to_1inch_diff,
            "Coingecko": coingecko_to_1inch_diff,
            "CoinmarketCap": cmc_to_1inch_diff
        }.items():
        if (abs(price_diff * 100) > MAX_PRICE_DEVIATION):
            error = "1Inch and {} have too large price deviation: {:.6f}%".format(protocol, price_diff * 100)
            print(console_colors["FAIL"] + error + console_colors["ENDC"])
            raise Exception(error)

    get_1inch_swap(from_token, to_token, from_amount, max_slippage, allow_partial_fill, min_tokens_with_slippage)

# from_token, to_token, from_token_amount, slippage, allow_partial_fill
# build_swap_tx(WETH, FRXETH, 300 * 10**18, 1, False)
# build_swap_tx(RETH, FRXETH, 300 * 10**18, 1, False)
# build_swap_tx(RETH, STETH, 5000 * 10**18, 1, False)
# build_swap_tx(RETH, STETH, 5000 * 10**18, 1, False)

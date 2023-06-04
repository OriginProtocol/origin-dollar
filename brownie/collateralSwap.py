from brownie import Contract
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
vault_core_w_swap_collateral = load_contract('vault_core_w_swap_collateral', VAULT_PROXY_ADDRESS)

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

def get_1inch_swap(from_token, to_token, from_amount, slippage, allowPartialFill):
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
    print("RESULT", result)
    input_decoded = router_1inch.decode_input(result['tx']['data'])
    print("input_decoded", input_decoded)

    data = ''
    # Swap selector
    if result['tx']['data'].startswith(SWAP_SELECTOR):
        data += SWAP_SELECTOR + eth_abi.encode_abi(['address', 'bytes'], [input_decoded[1][0], input_decoded[1][3]]).hex()
    elif result['tx']['data'].startswith(UNISWAP_SELECTOR):
        data += UNISWAP_SELECTOR + eth_abi.encode_abi(['uint256[]'], [input_decoded[1][3]]).hex()
    elif result['tx']['data'].startswith(UNISWAPV3_SELECTOR):
        data += UNISWAPV3_SELECTOR + eth_abi.encode_abi(['uint256[]'], [input_decoded[1][3]]).hex()
    else: 
        raise Exception("Unrecognised 1inch swap selector")

    
    swap_collateral_data = vault_core_w_swap_collateral.swapCollateral.encode_input(
        result['fromToken']['address'],
        result['toToken']['address'],
        result['fromTokenAmount'],
        result['toTokenAmount'], # TODO needs to be min amount with slippage
        data
    )

    print("swap_collateral_data", swap_collateral_data)

build_swap_tx(WETH, RETH, 100 * 10**18, 1)

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
#   - slippage -> allowed slippage when swapping expressed in percentage points
#                 2 = 2%
#   - partial_fill -> are partial fills allowed
def build_swap_tx(from_token, to_token, from_amount, slippage):
    if COINMARKETCAP_API_KEY is None:
        raise Exception("Set coinmarketcap api key by setting CMC_API_KEY variable. Free plan key will suffice: https://coinmarketcap.com/api/pricing/")

    min_slippage_amount = 10**16
    quote_1inch_min_swap_amount_price = get_1inch_quote(from_token, to_token, min_slippage_amount)
    quote_1inch_min_swap_amount = quote_1inch_min_swap_amount_price / min_slippage_amount * from_amount
    quote_1inch = get_1inch_quote(from_token, to_token, from_amount)
    quote_oracles = get_oracle_router_quote(from_token, to_token, from_amount)
    quote_coingecko = get_coingecko_quote(from_token, to_token, from_amount)
    quote_cmc = get_cmc_quote(from_token, to_token, from_amount)
    min_expected_amount = quote_oracles * slippage / 100

    print("------ Price Quotes ------")
    print("1Inch expected tokens:                   {:.6f}".format(quote_1inch / 10**18))
    print("1Inch expected tokens (min swap amount): {:.6f}".format(quote_1inch_min_swap_amount / 10**18))
    print("Oracle expected tokens:                  {:.6f}".format(quote_oracles / 10**18))
    print("Coingecko expected tokens:               {:.6f}".format(quote_coingecko / 10**18))
    print("CoinmarketCap expected tokens:           {:.6f}".format(quote_cmc / 10**18))
    print("       ------------       ")
    print("1Inch to Oracle Difference:              {:.6f}%".format((quote_1inch - quote_oracles) / quote_1inch))
    print("1Inch to Coingecko Difference:           {:.6f}%".format((quote_1inch - quote_coingecko) / quote_1inch))
    print("Minimum expected amount:                 {:.6f}%".format(min_expected_amount))

    get_1inch_swap(WETH, RETH, 100 * 10**18, 0.5, False)

build_swap_tx(WETH, RETH, 100 * 10**18, 1)






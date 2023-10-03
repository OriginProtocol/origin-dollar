from brownie import Contract
from brownie.convert.datatypes import HexString
from contextlib import redirect_stdout, contextmanager
import os
import io
import requests
import eth_abi

from world import *

COINMARKETCAP_API_KEY = os.getenv('CMC_API_KEY')
ONEINCH_SUBDOMAIN = os.getenv('ONEINCH_SUBDOMAIN')
ONEINCH_SUBDOMAIN = ONEINCH_SUBDOMAIN if len(ONEINCH_SUBDOMAIN) > 0 else 'api'

OUSD_ORACLE_ROUTER_ADDRESS = vault_admin.priceProvider()
OETH_ORACLE_ROUTER_ADDRESS = vault_oeth_admin.priceProvider()
oracle_router = load_contract('oracle_router_v2', OUSD_ORACLE_ROUTER_ADDRESS)
oeth_oracle_router = load_contract('oracle_router_v2', OETH_ORACLE_ROUTER_ADDRESS)

swapper_address = SWAPPER_1INCH

# what is the allowed price deviation between 1inch, oracles & coingecko and coinmarketcap
# 2 = 2%
MAX_PRICE_DEVIATION = 2

OUSD_ASSET_ADDRESSES = (DAI, USDT, USDC)

@contextmanager
def silent_tx():
    """
    Hide std out transaction information printing.

    ETH brownie does not currently have a way to silence transaction details.
    """
    f = io.StringIO()
    with redirect_stdout(f):
        yield

def scale_amount(from_token, to_token, amount, decimals=0):
    decimalsMap = {
        WETH: 18,
        RETH: 18,
        STETH: 18,
        FRXETH: 18,
        SFRXETH: 18,
        DAI: 18,
        USDT: 6,
        USDC: 6,

        'human': 0
    }
    scaled_amount = (amount * 10 ** decimalsMap[to_token]) / (10 ** decimalsMap[from_token])

    if decimals == 0:
        return int(scaled_amount)

    return int(scale_amount * 10**decimals) / (10**decimals)

def get_1inch_quote(from_token, to_token, from_amount):
    req = requests.get('https://{}.1inch.io/v5.0/1/quote'.format(ONEINCH_SUBDOMAIN), params={
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
        #CBETH: 21535

        DAI: 4943,
        USDT: 825,
        USDC: 3408,
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

    price = result["data"][str(idMap[from_token])]["quote"][str(idMap[to_token])]["price"]

    return scale_amount(from_token, to_token, from_amount * price)


def get_coingecko_quote(from_token, to_token, from_amount):
    assetsMap = {
        # Follows the format - [token_id, baseToken]
        WETH: ['weth', 'eth'],
        RETH: ['rocket-pool-eth', 'eth'],
        STETH: ['staked-ether', 'eth'],
        FRXETH: ['frax-ether', 'eth'],
        SFRXETH: ['staked-frax-ether', 'eth'],

        DAI: ['dai', 'usd'],
        USDT: ['tether', 'usd'],
        USDC: ['usd-coin', 'usd'],
    }

    from_token_id, from_base_asset = assetsMap[from_token]
    to_token_id, to_base_asset = assetsMap[to_token]

    if from_base_asset != to_base_asset:
        raise Exception("Unsupported conversion between OETH and OUSD tokens")

    req = requests.get('https://api.coingecko.com/api/v3/simple/price', params={
        'ids': "{},{}".format(from_token_id, to_token_id),
        'vs_currencies': from_base_asset
    }, headers={
        'accept': 'application/json'
    })
    
    if req.status_code != 200:
        print(req.json())
        raise Exception("Error accessing CoinGecko API")

    result = req.json()

    from_price = float(result[from_token_id][from_base_asset])
    to_price = float(result[to_token_id][from_base_asset])

    computed_price = (from_price * 10**18) / (to_price * 10**18)

    return scale_amount(from_token, to_token, from_amount * computed_price)

def get_1inch_swap(
    from_token,
    to_token,
    from_amount,
    slippage, 
    allowPartialFill,
    min_expected_amount,
):
    vault_addr = VAULT_PROXY_ADDRESS if from_token in OUSD_ASSET_ADDRESSES else VAULT_OETH_PROXY_ADDRESS
    c_vault_core = vault_core if from_token in OUSD_ASSET_ADDRESSES else oeth_vault_core

    router_1inch = load_contract('router_1inch_v5', ROUTER_1INCH_V5)
    SWAP_SELECTOR = "0x12aa3caf" #swap(address,(address,address,address,address,uint256,uint256,uint256),bytes,bytes)
    UNISWAP_SELECTOR = "0xf78dc253" #unoswapTo(address,address,uint256,uint256,uint256[])
    UNISWAPV3_SWAP_TO_SELECTOR = "0xbc80f1a8" #uniswapV3SwapTo(address,uint256,uint256,uint256[])


    req = requests.get('https://{}.1inch.io/v5.0/1/swap'.format(ONEINCH_SUBDOMAIN), params={
        'fromTokenAddress': from_token.lower(),
        'fromAddress': swapper_address.lower(),
        'destReceiver': vault_addr.lower(),
        'toTokenAddress': to_token.lower(),
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

    input_decoded = router_1inch.decode_input(result['tx']['data'])

    selector = result['tx']['data'][:10]
    data = '0x'
    # Swap selector
    if selector == SWAP_SELECTOR:
        data += eth_abi.encode_abi(['bytes4', 'address', 'bytes'], [HexString(selector, "bytes4"), input_decoded[1][0], input_decoded[1][3]]).hex()
    elif selector == UNISWAP_SELECTOR or selector == UNISWAPV3_SWAP_TO_SELECTOR:
        data += eth_abi.encode_abi(['bytes4', 'uint256[]'], [HexString(selector, "bytes4"), input_decoded[1][3]]).hex()

    else: 
        raise Exception("Unrecognized 1Inch swap selector {}".format(selector))

    swap_collateral_data = c_vault_core.swapCollateral.encode_input(
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
    #     "to": vault_addr,
    #     "value": 0,
    #     "gas": 2001000,
    #     "data": swap_collateral_data,
    #     "gasPrice": 123
    # })

    print("Execute the swap transaction on the Vault")
    print("to: {}".format(vault_addr))
    print("data: {}".format(swap_collateral_data))

    return vault_addr, swap_collateral_data

# using oracle router calculate what the expected `toTokenAmount` should be
# this function fails if Oracle data is too stale    
def get_oracle_router_quote(from_token, to_token, from_amount):
    router = oracle_router if from_token in OUSD_ASSET_ADDRESSES else oeth_oracle_router
    
    # Oracles communicate the price of token to ETH so to derive the the price
    # of one token to another we should multiply 2 oracle prices: 
    # X_TOKEN/ETH * ETH/Y_TOKEN to get the X_TOKEN/Y_TOKEN oracle price.
    # 
    # To get to ETH/Y_TOKEN price we just use 1 / (Y_TOKEN/ETH)
    from_price = router.price(from_token)
    to_price = 10**18 / router.price(to_token)

    return scale_amount(from_token, to_token, from_price * to_price * from_amount / 10**18)

console_colors = {}
console_colors["ENDC"] = '\033[0m'
console_colors["FAIL"] = '\033[91m'
console_colors["WARNING"] = '\033[93m'


# create a swap transaction
# params: 
#   - from_token -> address of token to swap
#   - to_token -> address of token to swap to
#   - from_amount -> amount of token 1 to swap
#   - max_slippage -> allowed slippage when swapping expressed in percentage points
#                 2 = 2%
#   - partial_fill -> are partial fills allowed
#   - dry_run -> If set to True, doesn't run the tx against the active network
def build_swap_tx(from_token, to_token, from_amount, max_slippage, allow_partial_fill, dry_run=True):
    if COINMARKETCAP_API_KEY is None:
        raise Exception("Set coinmarketcap api key by setting CMC_API_KEY variable. Free plan key will suffice: https://coinmarketcap.com/api/pricing/")

    min_slippage_amount = scale_amount(WETH, from_token, 10**18) # 1 token of from_token (like 1WETH, 1DAI or 1USDT)
    quote_1inch = get_1inch_quote(from_token, to_token, from_amount)
    quote_1inch_min_swap_amount_price = get_1inch_quote(from_token, to_token, min_slippage_amount)
    quote_1inch_min_swap_amount = from_amount * quote_1inch_min_swap_amount_price / min_slippage_amount
    quote_oracles = get_oracle_router_quote(from_token, to_token, from_amount)
    quote_coingecko = get_coingecko_quote(from_token, to_token, from_amount)
    quote_cmc = get_cmc_quote(from_token, to_token, from_amount)

    # subtract the max slippage from minimum slippage query
    min_tokens_with_slippage = scale_amount(from_token, to_token, from_amount * quote_1inch_min_swap_amount_price * (100 - max_slippage) / 100 / min_slippage_amount)
    coingecko_to_1inch_diff = (quote_1inch - quote_coingecko) / quote_1inch
    oracle_to_1inch_diff = (quote_1inch - quote_oracles) / quote_1inch
    cmc_to_1inch_diff = (quote_1inch - quote_cmc) / quote_1inch

    actual_slippage = (quote_1inch_min_swap_amount - quote_1inch) / quote_1inch

    print("------ Price Quotes ------")
    print("1Inch expected tokens:                   {:.6f}".format(scale_amount(to_token, 'human', quote_1inch)))
    print("1Inch expected tokens (no slippage):     {:.6f}".format(scale_amount(to_token, 'human', quote_1inch_min_swap_amount)))
    print("Oracle expected tokens:                  {:.6f}".format(scale_amount(to_token, 'human', quote_oracles)))
    print("Coingecko expected tokens:               {:.6f}".format(scale_amount(to_token, 'human', quote_coingecko)))
    print("CoinmarketCap expected tokens:           {:.6f}".format(scale_amount(to_token, 'human', quote_cmc)))
    print("Tokens expected (with {:.2f}% slippage)    {:.6f}".format(max_slippage, scale_amount(to_token, 'human', min_tokens_with_slippage)))
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

    to, data = get_1inch_swap(from_token, to_token, from_amount, max_slippage, allow_partial_fill, min_tokens_with_slippage)

    if dry_run == True:
        return to, data
    
    decoded_input = vault_core.swapCollateral.decode_input(data)
    return vault_core.swapCollateral(*decoded_input, {'from':STRATEGIST})


# from_token, to_token, from_token_amount, slippage, allow_partial_fill, dry_run
#build_swap_tx(WETH, FRXETH, 300 * 10**18, 1, False)


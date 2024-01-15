
import os
import requests

from world import *

COINMARKETCAP_API_KEY = os.getenv('CMC_API_KEY')

def scale_amount(from_token, to_token, amount, decimals=0):
    if from_token == to_token:
        return amount

    decimalsMap = {
        WETH: 18,
        RETH: 18,
        STETH: 18,
        FRXETH: 18,
        SFRXETH: 18,
        DAI: 18,
        USDT: 6,
        USDC: 6,

        CVX: 18,
        OGV: 18,
        OUSD: 18,
        OETH: 18,

        'human': 0
    }
    scaled_amount = (amount * 10 ** decimalsMap[to_token]) / (10 ** decimalsMap[from_token])

    if decimals == 0:
        return int(scaled_amount)

    return int(scale_amount * 10**decimals) / (10**decimals)
    
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

        OGV: 20949,
        CVX: 9903,
        OUSD: 7189,
        OETH: 24277,

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
        raise Exception("Error accessing CMC api")

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

        OGV: ['origin-dollar-governance', 'usd'],
        CVX: ['convex-finance', 'usd'],
        OETH: ['origin-ether', 'usd'],
        OUSD: ['origin-dollar', 'usd'],
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

def get_uniswap_v3_quote(path, amount):
    return uniswap_v3_quoter.quoteExactInput.call(
        path,
        amount,
    )

def get_uniswap_v3_price(path, amount):
    _, prices_after, _, _ = uniswap_v3_quoter.quoteExactOutput.call(
        path,
        1e18,
    )

    return parse_uniswap_x96_price(prices_after[len(prices_after - 1)])

def parse_uniswap_x96_price(amount):
    return (amount / (2 ** 96)) ** 2
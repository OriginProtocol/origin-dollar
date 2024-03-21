from brownie import Contract
from brownie.convert.datatypes import HexString
import os
import io
import requests
import eth_abi

from world import *
from prices import *
from oneinch import *

OUSD_ORACLE_ROUTER_ADDRESS = vault_admin.priceProvider()
OETH_ORACLE_ROUTER_ADDRESS = vault_oeth_admin.priceProvider()
oracle_router = load_contract('oracle_router_v2', OUSD_ORACLE_ROUTER_ADDRESS)
oeth_oracle_router = load_contract('oracle_router_v2', OETH_ORACLE_ROUTER_ADDRESS)

swapper_address = SWAPPER_1INCH

# what is the allowed price deviation between 1inch, oracles & coingecko and coinmarketcap
# 2 = 2%
MAX_PRICE_DEVIATION = 2

OUSD_ASSET_ADDRESSES = (DAI, USDT, USDC)

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

    result = get_1inch_swap_data(
        from_token=from_token.lower(),
        to_token=to_token.lower(),
        swap_amount=from_amount,
        slippage=slippage,
        from_address=swapper_address.lower(),
        to_address=vault_addr.lower(),
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

    swap_collateral_data = c_vault_core.swapCollateral.encode_input(
        from_token.lower(),
        to_token.lower(),
        "%.0f" % from_amount,
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

    c_vault_core = vault_core if from_token in OUSD_ASSET_ADDRESSES else oeth_vault_core
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
    return c_vault_core.swapCollateral(*decoded_input, {'from':STRATEGIST})


# from_token, to_token, from_token_amount, slippage, allow_partial_fill, dry_run
#build_swap_tx(WETH, FRXETH, 300 * 10**18, 1, False)


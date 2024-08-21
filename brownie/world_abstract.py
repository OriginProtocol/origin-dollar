import brownie
import json
import time
import re
from eth_abi import abi
from addresses import *
import addresses # We want to be able to get to addresses as a dict
from contextlib import redirect_stdout, contextmanager

def abi_to_disk(name, contract):
    with open("abi/%s.json" % name, 'w') as f:
        json.dump(contract.abi, f)

def load_contract(name, address):
    with open("abi/%s.json" % name, 'r') as f:
        abi = json.load(f)
        return brownie.Contract.from_abi(name, address, abi)

# unlock an address to issue transactions as that address
def unlock(address):
    brownie.network.web3.provider.make_request('hardhat_impersonateAccount', [address])

def fund_eth(address, balance):
    brownie.network.web3.provider.make_request('hardhat_setBalance', [address, balance])



def mine_block():
    brownie.network.web3.provider.make_request('evm_mine', [])

def leading_whitespace(s, desired = 16):
    return ' ' * (desired-len(s)) + s

def commas(v, decimals = 18, truncate=True):
    """Pretty format token amounts as floored, fixed size dollars"""

    if not truncate:
        v = int(10**4 * v / 10**decimals) / 10**4
        s = f'{v:,.2f}'
    else:
        v = int(v / 10**decimals)
        s = f'{v:,}'

    return leading_whitespace(s, 16)

# format BigNumber represented in 24 decimals
def c24(v):
    return commas(v, 24)

# format BigNumber represented in 18 decimals
def c18(v, truncate):
    return commas(v, 18, truncate)

# format BigNumber represented in 12 decimals
def c12(v):
    return commas(v, 12)

# format BigNumber represented in 6 decimals
def c6(v):
    return commas(v, 6)

def prices(p, decimals = 18):
    p = float(p / 10**decimals)
    return leading_whitespace('{:0.4f}'.format(p), 16)

def pcts (p):
    return leading_whitespace('{:0.4f}%'.format(p), 16)


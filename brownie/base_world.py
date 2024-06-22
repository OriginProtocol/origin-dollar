import brownie
import json
import time
import re
from eth_abi import abi
from base_addresses import *
import base_addresses # We want to be able to get to addresses as a dict
from contextlib import redirect_stdout, contextmanager

std = {'from': GOVERNOR}

def abi_to_disk(name, contract):
    with open("abi/%s.json" % name, 'w') as f:
        json.dump(contract.abi, f)

def load_contract(name, address):
    with open("abi/%s.json" % name, 'r') as f:
        abi = json.load(f)
        return brownie.Contract.from_abi(name, address, abi)

weth = load_contract('ERC20', WETH)
oeth = load_contract('ERC20', OETH)

oeth_vault_admin = load_contract('vault_admin', OETH_VAULT)
oeth_vault_core = load_contract('vault_core', OETH_VAULT)

# crate a temporary fork of a node that cleans up ethereum state when exiting code block
class TemporaryFork:
    def __enter__(self):
        brownie.chain.snapshot()

    def __exit__(self, *args, **kwargs):
        brownie.chain.revert()
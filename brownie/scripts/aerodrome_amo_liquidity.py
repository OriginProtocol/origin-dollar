import brownie
import json
import time
import re
from eth_abi import abi
from addresses import *
import addresses # We want to be able to get to addresses as a dict
from contextlib import redirect_stdout, contextmanager
DEPLOYER = "0xFD9E6005187F448957a0972a7d0C0A6dA2911236"
FUTURE_EPOCH = 1923907692
WETH = "0x4200000000000000000000000000000000000006"
OETHB = "0xDBFeFD2e8460a6Ee4955A68582F85708BAEA60A3"
DEPLOYER_ARGS = {"from": DEPLOYER}

def abi_to_disk(name, contract):
    with open("abi/%s.json" % name, 'w') as f:
        json.dump(contract.abi, f)

def load_contract(name, address):
    with open("abi/%s.json" % name, 'r') as f:
        abi = json.load(f)
        return brownie.Contract.from_abi(name, address, abi)

weth = load_contract('ERC20', WETH)
oethb = load_contract('ousd', OETHB)
nftm = load_contract('aerodrome_nonfungible_position_manager', "0x827922686190790b37229fd06084350E74485b72")
pool = load_contract('aerodrome_slipstream_pool', "0x6446021F4E396dA3df4235C62537431372195D38")
sugar = load_contract('aerodrome_slipstream_sugar_helper', "0x0AD09A66af0154a84e86F761313d02d0abB6edd5")

# decrease the existing liquidity down to a 0
# Tenderly tuple
#{"tokenId": 342186, "liquidity": 200014999875006249609, "amount0Min": 0, "amount1Min": 0, "deadline": 1923907692}
nftm.decreaseLiquidity((342186, 200014999875006249609, 0, 0, FUTURE_EPOCH), DEPLOYER_ARGS)

# this is 0 at block 18558804 after the above withdrawal
pool.liquidity()

oethb.approve(nftm.address, 1e30, DEPLOYER_ARGS)
weth.approve(nftm.address, 1e30, DEPLOYER_ARGS)

sqrtLower = sugar.getSqrtRatioAtTick(-1)
sqrtHigher = sugar.getSqrtRatioAtTick(0)
wethPoolShare = 0.2
sqrtTarget = sqrtLower + (sqrtHigher - sqrtLower) * wethPoolShare

# try to deposit liquidity in correct target tick. Doesn't work because sqrtPriceX96 set at non 0 tries to create a pool
# {"token0": "0x4200000000000000000000000000000000000006", "token1": "0xDBFeFD2e8460a6Ee4955A68582F85708BAEA60A3", "tickSpacing": 1, "tickLower": -1, "tickUpper": 0, "amount0Desired": 10000000000000, "amount1Desired": 10000000000000, "amount0Min": 0, "amount1Min": 0, "recipient": "0xFD9E6005187F448957a0972a7d0C0A6dA2911236", "deadline": 1923907692, "sqrtPriceX96": 0}
tx = nftm.mint((WETH, OETHB, 1, -1, 0, 1e13, 1e13, 0, 0, DEPLOYER, FUTURE_EPOCH, sqrtTarget), DEPLOYER_ARGS)

# this works
# even if the pool has 0 liquidity (meaning liquidity has been added to the pool at creation and then removed) the
# pool doesn't allow for adding liquidity into an arbitrary tick. The pool still enforces the respect of the last price
# that was active before all the liquidity has been removed. Meaning we can not set a new pool price when re-deploying
# fresh liquidity for the 2nd (and all subsequent times.)
tx = nftm.mint((WETH, OETHB, 1, -1, 0, 1e13, 1e13, 0, 0, DEPLOYER, FUTURE_EPOCH, 0), DEPLOYER_ARGS)

tx.info()
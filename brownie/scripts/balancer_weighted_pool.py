# Using various WEIGTED POOL weights figure out how a range of swaps using different swap
# amounts effects the price impact on different pool configurations. Graph out the results so 
# it is easier to comprehend.

from world import *
import secrets
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

WEIGHTED_POOL_FACTORY_V4 = "0x897888115Ada5773E02aA29F775430BFB5F34c51"
POOL_REGISTERED_TOPIC = "0x3c13bc30b8e878c53fd2a36b679409c073afd75950be43d8858768e956fbc20e"
ZERO = "0x0000000000000000000000000000000000000000"
factory = Contract.from_explorer(WEIGHTED_POOL_FACTORY_V4)
meta_stable_factory = Contract.from_explorer("0x67d27634E44793fE63c467035E31ea8635117cd4")
WETH_BAGS = "0xF04a5cC80B1E94C69B48f5ee68a08CD2F09A7c3E"
ba_vault = Contract.from_explorer("0xBA12222222228d8Ba445958a75a0704d566BF2C8")
balancerUserDataEncoder = load_contract('balancerUserData', vault_oeth_admin.address)
STD = {"from": STRATEGIST }
# amount of weth to deposit. The other side (OETH shall be printed according to weighted pool proportions)
WETH_TO_DEPOSIT = 5000 * 1e18

# fund weth
weth.transfer(STRATEGIST, 5e23, {"from": WETH_BAGS})
# mint OETH
weth.approve(oeth_vault_core.address, 1e50, {"from": STRATEGIST})
oeth_vault_core.mint(WETH, 2e23, 0, {"from": STRATEGIST})
oeth.approve(ba_vault.address, 10**50, STD)
weth.approve(ba_vault.address, 10**50, STD)

def plot_weighted_pool_test(stable_pool):
  pool_configs = [
    [0.1, 0.9],
    [0.2, 0.8],
    [0.3, 0.7],
    [0.4, 0.6],
    [0.5, 0.5],
    [0.6, 0.4],
    [0.7, 0.3],
    [0.8, 0.2],
    [0.9, 0.1],
  ]

  pools = [stable_pool]

  # INITIALIZE ALL THE POOLS
  for [w1, w2] in pool_configs:
    # used by create2 call
    salt = "0x{0}".format(secrets.token_hex(15))

    name = "{0}OETH-{1}WETH".format(w1, w2)
    # swap fee is 0.04%
    tx = factory.create(name, name, [OETH, WETH], [w1 * 10**18, w2 * 10**18], [ZERO, ZERO], 400000000000000, TIMELOCK, salt, STD)

    pool_address = tx.logs[1].topics[1].hex()[:42]
    pool_id = tx.logs[1].topics[1].hex()
    pool = load_contract("balancer_weighted_pool", pool_address)

    # deposit fixed amount of WETH and OETH in proportion to pool weights while keeping
    # the fixed amount of WETH
    amounts_in = [1/w2 * w1 * WETH_TO_DEPOSIT, WETH_TO_DEPOSIT] # min amounts in
    tx_join = ba_vault.joinPool(
      pool_id,
      STRATEGIST, #sender
      STRATEGIST, #recipient
      [
        # tokens need to be sorted numerically
        [OETH, WETH], # assets
        # DEPLOY 1000 units proportional to the weights of the pool
        amounts_in, # min amounts in
        # INIT JOIN ['uint256', 'uint256[]'] : [INIT, amountsIn]
        balancerUserDataEncoder.userDataInitJoin.encode_input(0, amounts_in)[10:],
        False, #fromInternalBalance
      ],
      STD
    )

    pools.append({
      "pool": pool,
      "pool_id": pool_id,
      "name": name
    })


  x = []
  # PERFORM SWAPS
  for pool in pools:
    # positive is swap OETH -> WETH, negative is swap WETH -> OETH
    swap_range_raw = list(range(50, -51, -2))
    # replace 0 with -1 & 1
    swap_range = swap_range_raw[:25] + [1, -1] + swap_range_raw[26:]

    x = swap_range
    y = []
    for swap_amount in swap_range:
      with TemporaryFork():
        amount_in = abs(swap_amount) * 10**18
        min_amount_out = 0
        price_impact_pct = 0

        pool_id = pool["pool_id"]
        tx = ba_vault.swap(
          # 0 is swap kind GIVEN_IN
          (pool_id, 0, OETH if swap_amount >= 0 else WETH, WETH if swap_amount >= 0 else OETH, amount_in, "0x"), #singleSwap swap((bytes32,uint8,address,address,uint256,bytes)
          (STRATEGIST, False, STRATEGIST,  False), #funds (address,bool,address,bool)
          min_amount_out, #token amount out
          web3.eth.getBlock("latest")["timestamp"] + 10000000, #deadline
          STD
        )
        amounts_sent_in = int(tx.logs[0]["data"][:66], 16)
        amounts_sent_out = int("0x" + tx.logs[0]["data"][66:], 16)
        price_impact_pct = (amount_in - amounts_sent_out) / amount_in * 100
        y.append(price_impact_pct)

    # X axis parameter:
    xaxis = np.array(x)
    # Y axis parameter:
    yaxis = np.array(y)
    plt.plot(xaxis, yaxis, label=pool["name"])

  plt.xlabel("Tokens swapped [if > 0 OETH->WETH else WETH->OETH]")
  plt.ylabel("Price impact [%]")
  plt.axhline(0, c="grey", linewidth=0.5)
  plt.axhline(0, c="black", linewidth=0.4)
  plt.legend()

def create_meta_stable_pool():
  name = "stable"
  # 0.04% swap fee
  tx = meta_stable_factory.create(name, name, [OETH, WETH], 50, [ZERO, ZERO], [0,0], 400000000000000, False, STRATEGIST, STD)
  pool_address = tx.logs[1].topics[1].hex()[:42]
  pool_id = tx.logs[1].topics[1].hex()

  amounts_in = [WETH_TO_DEPOSIT, WETH_TO_DEPOSIT] # min amounts in
  tx_join = ba_vault.joinPool(
    pool_id,
    STRATEGIST, #sender
    STRATEGIST, #recipient
    [
      # tokens need to be sorted numerically
      [OETH, WETH], # assets
      # DEPLOY 1000 units proportional to the weights of the pool
      amounts_in, # min amounts in
      # INIT JOIN ['uint256', 'uint256[]'] : [INIT, amountsIn]
      balancerUserDataEncoder.userDataInitJoin.encode_input(0, amounts_in)[10:],
      False, #fromInternalBalance
    ],
    STD
  )

  return {
    "pool": (),
    "pool_id": pool_id,
    "name": name
  }


pool = create_meta_stable_pool()
plot_weighted_pool_test(pool)
plt.show()


# --------------------------------
# April 12, 2023 - Weekly allocation
# 

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
Existing Allocation	49.75%
Convex OUSD+3Crv	17.42%
Morpho Aave USDT	11.18%
Morpho Compound USDT	8.41%
Morpho Compound USDC	4.6%
Morpho Compound DAI	4.11%
Morpho Aave USDC	1.89%
Convex DAI+USDC+USDT	1.23%
Convex LUSD+3Crv	1.23%
Aave USDT	0.19%
Aave DAI	0%
Aave USDC	0%
Compound DAI	0%
Compound USDC	0%
Compound USDT	0%
Morpho Aave DAI	0%
"""


with TemporaryForkWithVaultStats(votes):
    before_votes = with_target_allocations(load_from_blockchain(), votes)

    txs = []
    txs.extend(auto_take_snapshot())

    # From
    txs.append(from_strat(MORPHO_AAVE_STRAT, [[640_045, dai], [725_799, usdc], [2_161_415, usdt]]))
    txs.append(from_strat(MORPHO_COMP_STRAT, [[1_491_657, dai], [1_615_396, usdc]]))

    # To
    txs.append(to_strat(MORPHO_COMP_STRAT, [[2_182_000, usdt]]))
    txs.append(to_strat(LUSD_3POOL_STRAT, [[346_000, usdc]]))
    txs.append(to_strat(CONVEX_STRAT, [[346_000, usdc]]))
    txs.append(to_strat(OUSD_METASTRAT, [[2_131_000, dai],[1_648_000, usdc]]))
    
    # # Defaults
    # txs.append(vault_admin.setAssetDefaultStrategy(dai, MORPHO_AAVE_STRAT,{'from':STRATEGIST}))

    txs.extend(auto_check_snapshot())
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# April 15, 2023 - Pull from Compound
# 

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
Existing Allocation 49.75%
Convex OUSD+3Crv    17.42%
Morpho Aave USDT    11.18%
Morpho Compound USDT    8.41%
Morpho Compound USDC    4.6%
Morpho Compound DAI 4.11%
Morpho Aave USDC    1.89%
Convex DAI+USDC+USDT    1.23%
Convex LUSD+3Crv    1.23%
Aave USDT   0.19%
Aave DAI    0%
Aave USDC   0%
Compound DAI    0%
Compound USDC   0%
Compound USDT   0%
Morpho Aave DAI 0%
"""


with TemporaryForkWithVaultStats(votes):
    before_votes = with_target_allocations(load_from_blockchain(), votes)

    txs = []
    txs.extend(auto_take_snapshot())

    # From
    txs.append(vault_admin.withdrawAllFromStrategy(MORPHO_COMP_STRAT, {'from': STRATEGIST}))
    txs.append(vault_admin.withdrawAllFromStrategy(COMP_STRAT, {'from': STRATEGIST}))

    # # Defaults
    txs.append(vault_admin.setAssetDefaultStrategy(dai, MORPHO_AAVE_STRAT,{'from':STRATEGIST}))

    txs.extend(auto_check_snapshot())
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)
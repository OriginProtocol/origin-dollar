
# --------------------------------
# Feb 28, 2023 - Weekly allocation
# 

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
Morpho Aave USDT    39.04%
Convex OUSD+3Crv    32.18%
Morpho Aave DAI 9.23%
Morpho Aave USDC    9.23%
Convex DAI+USDC+USDT    4.96%
Aave USDT   1.02%
Compound USDC   1.02%
Morpho Compound DAI 1.02%
Morpho Compound USDC    1.02%
Morpho Compound USDT    1.02%
Convex LUSD+3Crv    0.3%
Existing Allocation 0%
Aave DAI    0%
Aave USDC   0%
Compound DAI    0%
Compound USDT   0%
    """

with TemporaryForkWithVaultStats(votes):
    before_votes = with_target_allocations(load_from_blockchain(), votes)

    txs = []
    txs.extend(auto_take_snapshot())

    # # From
    txs.append(from_strat(MORPHO_COMP_STRAT, [[483_083, dai], [526_766, usdc], [3_155_766, usdt]]))
    txs.append(from_strat(OUSD_METASTRAT, [[1_300_000+257_000, dai], [1_488_000+257_000, usdc], [5_200_000+257_000, usdt]]))
        
    # # Swap

    # # To
    txs.append(to_strat(MORPHO_AAVE_STRAT, [[1_783_000, dai], [1_691_328, usdc], [8_050_000, usdt]]))
    txs.append(to_strat(COMP_STRAT, [[323_000, usdc]]))
    txs.append(to_strat(AAVE_STRAT, [[323_000, usdt]]))
    txs.append(to_strat(CONVEX_STRAT, [[257_000, dai], [257_000, usdc], [257_000, usdt]]))
    
    # # Defaults
    # txs.append(vault_admin.setAssetDefaultStrategy(dai, MORPHO_AAVE_STRAT,{'from':STRATEGIST}))

    txs.extend(auto_check_snapshot())
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


# safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
# safe_tx = safe.multisend_from_receipts(txs)
# safe.sign_with_frame(safe_tx)
# r = safe.post_transaction(safe_tx)
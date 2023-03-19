
# --------------------------------
# Mar 10, 2023 - Weekly allocation
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



# --------------------------------
# March 10, 2023 - USDC Depeg
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

    # From
    txs.append(vault_admin.withdrawAllFromStrategy(LUSD_3POOL_STRAT, {'from': STRATEGIST}))
    txs.append(vault_admin.withdrawAllFromStrategy(CONVEX_STRAT, {'from': STRATEGIST}))

    txs.extend(auto_check_snapshot())
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)



# --------------------------------
# March 10, 2023 - USDC Depeg
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

    # From
    txs.append(vault_admin.withdrawAllFromStrategy(OUSD_METASTRAT, {'from': STRATEGIST}))

    txs.extend(auto_check_snapshot())
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)



# --------------------------------
# March 10, 2023 - USDC Depeg
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

    # From
    # txs.append(vault_admin.withdrawAllFromStrategy(LUSD_3POOL_STRAT, {'from': STRATEGIST}))
    txs.append(vault_admin.withdrawAllFromStrategy(CONVEX_STRAT, {'from': STRATEGIST}))

    txs.extend(auto_check_snapshot())
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)



# --------------------------------
# March 10, 2023 - More Depeg
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
    # txs.extend(auto_take_snapshot())

    # From
    txs.append(from_strat(MORPHO_COMP_STRAT, [[483_083, dai], [526_766, usdc], [3_155_766, usdt]]))
    txs.append(from_strat(MORPHO_AAVE_STRAT, [ [3_155_766, usdt]]))

    # txs.extend(auto_check_snapshot())
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# March 11, 2023 - Depeg IN
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

    # From
    txs.append(to_strat(OUSD_METASTRAT, [[1_000_000, usdc]]))

    txs.extend(auto_check_snapshot())
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)



# --------------------------------
# March 16, 2023 - Weekly allocation
# 

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
Convex OUSD+3Crv    32.08%
Morpho Compound USDT    27.97%
Existing Allocation 11.92%
Morpho Aave USDT    9.59%
Aave USDT   8.88%
Morpho Compound DAI 3.58%
Morpho Compound USDC    3.58%
Morpho Aave DAI 1.19%
Morpho Aave USDC    1.19%
Aave DAI    0%
Aave USDC   0%
Compound DAI    0%
Compound USDC   0%
Compound USDT   0%
Convex DAI+USDC+USDT    0%
Convex LUSD+3Crv    0%
"""

with TemporaryForkWithVaultStats(votes):
    before_votes = with_target_allocations(load_from_blockchain(), votes)

    txs = []
    txs.extend(auto_take_snapshot())

    # From
    txs.append(vault_admin.withdrawAllFromStrategy(COMP_STRAT, {'from':STRATEGIST}))
    # the minus 721_000 is because we can't deploy those funds to MORPHO_COMP_STRAT
    # because the USDC is paused in there
    txs.append(from_strat(MORPHO_AAVE_STRAT, [[4_660_800, dai], [5_576_000, usdc], [5_923_000, usdt]]))

    # Swap
    txs.append(to_strat(CONVEX_STRAT, [[3_943_000, dai]]))
    txs.append(from_strat(CONVEX_STRAT, [[3_933_000, usdt]]))

    # To
    txs.append(to_strat(OUSD_METASTRAT, [[5_910_000, usdc]]))
    txs.append(to_strat(AAVE_STRAT, [[2_233_000, usdt]]))

    txs.append(to_strat(MORPHO_COMP_STRAT, [[721_000, dai], [7_600_000, usdt]]))
    #txs.append(to_strat(COMP_STRAT, [[323_000, usdc]]))
    #txs.append(to_strat(AAVE_STRAT, [[323_000, usdt]]))
    #txs.append(to_strat(CONVEX_STRAT, [[257_000, dai], [257_000, usdc], [257_000, usdt]]))
    
    # # Defaults
    # txs.append(vault_admin.setAssetDefaultStrategy(dai, MORPHO_AAVE_STRAT,{'from':STRATEGIST}))

    txs.extend(auto_check_snapshot())
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


# safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
# safe_tx = safe.multisend_from_receipts(txs)
# safe.sign_with_frame(safe_tx)
# r = safe.post_transaction(safe_tx)

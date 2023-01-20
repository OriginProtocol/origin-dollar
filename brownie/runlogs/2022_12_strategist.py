# --------------------------------
# Dec 7, 2022 
# 

from world import *
from allocations import *
from ape_safe import ApeSafe


votes = """
    Convex OUSD/3Crv    30.17
    Morpho Compound USDT    16.29
    Morpho Compound DAI 8.43
    Morpho Compound USDC    5.19
    Aave USDT   4.88
    Compound USDT   4.88
    Aave DAI    1.08
    Aave USDC   1.08
    Compound DAI    1.08
    Compound USDC   1.08
    Convex DAI/USDC/USDT    1.08
    Existing Allocation 24.74
    """

with TemporaryFork():
    before_allocation = with_target_allocations(load_from_blockchain(), votes)
    print(pretty_allocations(before_allocation))
    before = vault_core.totalValue()
    txs = [
        vault_core.rebase({'from': STRATEGIST}),
        vault_value_checker.takeSnapshot({"from": STRATEGIST}),
        
        reallocate(AAVE_STRAT,   MORPHO_COMP_STRAT, [[500_000, dai], [500_000, usdc], [1_080_000, usdt]]),
        reallocate(COMP_STRAT,   MORPHO_COMP_STRAT, [[1_070_000, dai], [1_070_000, usdc], [700_000, usdt]]),


        reallocate(OUSD_META_STRAT,   CONVEX_STRAT, [[1_216_000, dai]]),
        reallocate(MORPHO_COMP_STRAT, CONVEX_STRAT, [[1_158_000, usdc]]),

        reallocate(CONVEX_STRAT, MORPHO_COMP_STRAT, [[2_259_000, usdt]]),
        
        vault_admin.setAssetDefaultStrategy(DAI, MORPHO_COMP_STRAT, {'from': STRATEGIST}),
        vault_admin.setAssetDefaultStrategy(USDC, MORPHO_COMP_STRAT, {'from': STRATEGIST}),
        vault_admin.setAssetDefaultStrategy(USDT, MORPHO_COMP_STRAT, {'from': STRATEGIST}),

        vault_value_checker.checkDelta(-1378302004686863985848902,-1376802004686863985848902,-1378399395878459980498569,-1376899395878459980498569, {"from": STRATEGIST}),
    ]
    
    snapshot = vault_value_checker.snapshots(STRATEGIST)
    print(snapshot)
    vault_change = vault_core.totalValue() - snapshot[0]
    supply_change = ousd.totalSupply() - snapshot[1]

    
    print(",".join([
        str(vault_change - 500 * int(1e18)),
        str(vault_change + 1000 * int(1e18)),
        str(supply_change - 1000 * int(1e18)),
        str(supply_change + 500 * int(1e18))
        ]))
    after_allocaiton = with_target_allocations(load_from_blockchain(), before_allocation)
    print(pretty_allocations(after_allocaiton))
    allocation_exposure(after_allocaiton)
    show_default_strategies()
    print("Vault change", c18(vault_change))
    print("Supply change", c18(supply_change))
    print("Profit change", c18(vault_change - supply_change))
    print("")

safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# Dec 27, 2022 - Weekly allocation
# 

from world import *
from allocations import *
from ape_safe import ApeSafe


votes = """
    Convex OUSD+3Crv    21.07
    Morpho Compound USDT    17.68
    Aave USDT   11.78
    Compound USDT   10.39
    Morpho Compound USDC    3.67
    Morpho Compound DAI 3.33
    Convex DAI+USDC+USDT    0.84
    Aave DAI    0.09
    Aave USDC   0.09
    Compound DAI    0.09
    Compound USDC   0.09
    Existing Allocation 30.87
    """

with TemporaryFork():
    before_allocation = with_target_allocations(load_from_blockchain(), votes)
    print(pretty_allocations(before_allocation))
    before = vault_core.totalValue()
    txs = [
        vault_core.rebase({'from': STRATEGIST}),
        vault_value_checker.takeSnapshot({"from": STRATEGIST}),

        # DAI and USDC to Convex
        reallocate(AAVE_STRAT, CONVEX_STRAT, [[442_000, dai], [442_000, usdc]]),
        reallocate(COMP_STRAT, CONVEX_STRAT, [[570_000, dai], [570_000, usdc]]),
        reallocate(MORPHO_COMP_STRAT, CONVEX_STRAT, [[1_247_000, dai], [321_000, usdc]]),

        # USDT out of convex
        reallocate(CONVEX_STRAT, COMP_STRAT, [[1_938_000, usdt]]),
        reallocate(CONVEX_STRAT, MORPHO_COMP_STRAT, [[1_687_000, usdt]]),

        # USDT out of metastrat
        reallocate(OUSD_META_STRAT, AAVE_STRAT, [[2_350_000, usdt]]),
        reallocate(OUSD_META_STRAT, MORPHO_COMP_STRAT, [[162_000, usdt]]),

        vault_value_checker.checkDelta(-3027702270861360160101954,-3026202270861360160101954,-3028204672710532078676319,-3026704672710532078676319, {"from": STRATEGIST}),
    ]
    
    snapshot = vault_value_checker.snapshots(STRATEGIST)
    print(snapshot)
    vault_change = vault_core.totalValue() - snapshot[0]
    supply_change = ousd.totalSupply() - snapshot[1]

    
    print(",".join([
        str(vault_change - 500 * int(1e18)),
        str(vault_change + 1000 * int(1e18)),
        str(supply_change - 1000 * int(1e18)),
        str(supply_change + 500 * int(1e18))
        ]))
    after_allocaiton = with_target_allocations(load_from_blockchain(), before_allocation)
    print(pretty_allocations(after_allocaiton))
    allocation_exposure(after_allocaiton)
    show_default_strategies()
    print("Vault change", c18(vault_change))
    print("Supply change", c18(supply_change))
    print("Profit change", c18(vault_change - supply_change))
    print("")

# safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
# safe_tx = safe.multisend_from_receipts(txs)
# safe.sign_with_frame(safe_tx)
# r = safe.post_transaction(safe_tx)



# --------------------------------
# Dec 29, 2022 - USDT Exposure reduction
# (Never run)
# 

from world import *
from allocations import *
from ape_safe import ApeSafe


# votes = """
#     Existing Allocation 100
#     """

# with TemporaryFork():
#     before_allocation = with_target_allocations(load_from_blockchain(), votes)
#     print(pretty_allocations(before_allocation))
#     before = vault_core.totalValue()
#     txs = [
#         vault_core.rebase({'from': STRATEGIST}),
#         vault_value_checker.takeSnapshot({"from": STRATEGIST}),

#         # DAI and USDC to Convex
#         vault_admin.withdrawAllFromStrategy(OUSD_META_STRAT, {"from": STRATEGIST}),
#         vault_admin.withdrawAllFromStrategy(CONVEX_STRAT, {"from": STRATEGIST}),
#         vault_core.allocate({"from": STRATEGIST}),

#         vault_value_checker.checkDelta(-13256193791827716692312974,-13254693791827716692312974,-13257006307887216234576541,-13255506307887216234576541, {"from": STRATEGIST}),
#     ]
    
#     snapshot = vault_value_checker.snapshots(STRATEGIST)
#     print(snapshot)
#     vault_change = vault_core.totalValue() - snapshot[0]
#     supply_change = ousd.totalSupply() - snapshot[1]

    
#     print(",".join([
#         str(vault_change - 500 * int(1e18)),
#         str(vault_change + 5000 * int(1e18)),
#         str(supply_change - 5000 * int(1e18)),
#         str(supply_change + 500 * int(1e18))
#         ]))
#     after_allocaiton = with_target_allocations(load_from_blockchain(), before_allocation)
#     print(pretty_allocations(after_allocaiton))
#     allocation_exposure(after_allocaiton)
#     show_default_strategies()
#     print("Vault change", c18(vault_change))
#     print("Supply change", c18(supply_change))
#     print("Profit change", c18(vault_change - supply_change))
#     print("")

# safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
# safe_tx = safe.multisend_from_receipts(txs)
# safe.sign_with_frame(safe_tx)
# r = safe.post_transaction(safe_tx)



# --------------------------------
# Dec 30, 2022 - Weekly allocation
# 

from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
    Convex OUSD+3Crv    36.51
    Morpho Compound USDT    25.93
    Aave USDT   12.82
    Morpho Compound DAI 7.53
    Morpho Compound USDC    7.51
    Compound USDT   4.32
    Aave DAI    1
    Aave USDC   1
    Compound DAI    1
    Compound USDC   1
    Convex DAI+USDC+USDT    1
    Existing Allocation 0.4
    """

with TemporaryFork():
    before_allocation = with_target_allocations(load_from_blockchain(), votes)
    print(pretty_allocations(before_allocation))
    before = vault_core.totalValue()
    
    txs = []

    txs.extend(auto_take_snapshot())
    txs.append(reallocate(COMP_STRAT, MORPHO_COMP_STRAT, [[1_000_000, usdt]])),
    txs.append(reallocate(COMP_STRAT, OUSD_META_STRAT, [[1_000_000, usdt]])),
    txs.extend(auto_check_snapshot())

    snapshot = vault_value_checker.snapshots(STRATEGIST)
    print(snapshot)
    vault_change = vault_core.totalValue() - snapshot[0]
    supply_change = ousd.totalSupply() - snapshot[1]

    after_allocaiton = with_target_allocations(load_from_blockchain(), votes)
    print(pretty_allocations(after_allocaiton))
    allocation_exposure(after_allocaiton)
    show_default_strategies()
    print("Vault change", c18(vault_change))
    print("Supply change", c18(supply_change))
    print("Profit change", c18(vault_change - supply_change))
    print("")

safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


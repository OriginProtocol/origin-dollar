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
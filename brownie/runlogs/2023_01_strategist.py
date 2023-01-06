# --------------------------------
# Jan 6, 2022 - Weekly allocation
# 

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
	Convex OUSD+3Crv	20.08
	Convex LUSD+3Crv	0.3
	Convex DAI+USDC+USDT	0.4
	Morpho Compound USDT	10.75
	Morpho Compound DAI	0.8
	Morpho Compound USDC	0.8
	Aave DAI	0.8
	Aave USDC	0.8
	Aave USDT	4.71
	Compound USDT	3.91
	Compound DAI	0.4
	Compound USDC	0.4
	Existing Allocation	55.81
    """

with TemporaryFork():
    before_allocation = with_target_allocations(load_from_blockchain(), votes)
    before_votes = before_allocation
    print(pretty_allocations(before_allocation))
    before = vault_core.totalValue()
    
    txs = []

    txs.extend(auto_take_snapshot())
    
    allocation = with_target_allocations(load_from_blockchain(), before_votes)
    txs.extend(auto_consolidate_stables(allocation, consolidation="AAVE"))

    txs.append(reallocate(AAVE_STRAT, OUSD_META_STRAT, [[530_000, dai], [425_000, usdc], [460_000, usdt]]))
    txs.append(reallocate(AAVE_STRAT, LUSD_3POOL_STRAT, [[100_000, usdt]]))

    allocation = with_target_allocations(load_from_blockchain(), before_votes)
    txs.extend(auto_distribute_stables(allocation, consolidation="AAVE", min_move=50_000))

    txs.extend(auto_check_snapshot())

    snapshot = vault_value_checker.snapshots(STRATEGIST)
    vault_change = vault_core.totalValue() - snapshot[0]
    supply_change = ousd.totalSupply() - snapshot[1]

    after_allocaiton = with_target_allocations(load_from_blockchain(), before_votes)
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


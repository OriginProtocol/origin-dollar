# --------------------------------
# Nov 3, 2022 OGV Buyback
# 


from world import *
from ape_safe import ApeSafe


MIN_PERCENT_AFTER_SLIPPAGE = 0.97
REWARDS = "0x7d82E86CF1496f9485a8ea04012afeb3C7489397"
buyback = Contract.from_abi("Buyback", vault_core.trusteeAddress(), buyback.abi)
ogv = Contract.from_explorer("0x9c354503C38481a7A7a51629142963F98eCC12D0")

BUYBACK_AMOUNT = ousd.balanceOf(buyback)


amount_no_mev = 0

# Nominal price sim
with TemporaryFork():
    before = ogv.balanceOf(REWARDS)
    buyback.swapNow(1e18, 1, {'from': STRATEGIST})
    after = ogv.balanceOf(REWARDS)
    amount_no_mev = after - before

print("Best-case buyback amount %s OUSD for %s OGV" % (
    c18(BUYBACK_AMOUNT),
    c18(amount_no_mev*BUYBACK_AMOUNT/int(1e18))
))
print("Best-case price $%f"%(1e18 / amount_no_mev))


# Expected Swap sim
with TemporaryFork():
    before = ogv.balanceOf(REWARDS)
    buyback.swapNow(BUYBACK_AMOUNT, 1, {'from': STRATEGIST})
    print(history[-1].call_trace(True))
    after = ogv.balanceOf(REWARDS)
    amount_no_mev = after - before

print("Target buyback amount %s OUSD for %s OGV"%(c18(BUYBACK_AMOUNT), c18(amount_no_mev)))
print("Target price $%f"%(BUYBACK_AMOUNT / amount_no_mev))
print("Min amount %s OGV"%(c18(int(amount_no_mev*MIN_PERCENT_AFTER_SLIPPAGE))))
print("Submit with 500,000 gas")

# Actual Swap TX
txs = [
    buyback.swapNow(BUYBACK_AMOUNT, int(amount_no_mev*MIN_PERCENT_AFTER_SLIPPAGE), {'from': STRATEGIST})
]

# Send
safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)




# --------------------------------
# Nov 8, 2022 Initial MetaStrategy Depost
# 

from world import *
from allocations import *
from ape_safe import ApeSafe

with TemporaryFork():
    print(load_from_blockchain())
    before = vault_core.totalValue()
    txs = [
        vault_value_checker.takeSnapshot({"from": STRATEGIST}),
        vault_admin.reallocate(OUSD_META_STRAT, COMP_STRAT, [usdc], [int(481000 * 1e6)], {'from': STRATEGIST}),
        vault_value_checker.checkLoss(-480800*1e18, {"from": STRATEGIST}),
    ]
    print("Vault change", c18(vault_core.totalValue() - before))
    print("Snapshot before", c18(vault_value_checker.snapshotValue()))
    print("Vault After", c18(vault_core.totalValue()))
    print("Snapshot change", c18(vault_core.totalValue()-vault_value_checker.snapshotValue()))
    print(load_from_blockchain())
    print("")

safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)




# --------------------------------
# Nov 8, 2022 USDT depeg
# 

from world import *
from allocations import *
from ape_safe import ApeSafe

with TemporaryFork():
    print(load_from_blockchain())
    before = vault_core.totalValue()
    txs = [
        vault_value_checker.takeSnapshot({"from": STRATEGIST}),
        vault_admin.reallocate(OUSD_META_STRAT, COMP_STRAT, [usdc], [int(100000 * 1e6)], {'from': STRATEGIST}),
        vault_value_checker.checkLoss(100000 * 1e18, {"from": STRATEGIST}),
    ]
    print("Vault change", c18(vault_core.totalValue() - before))
    print("Snapshot before", c18(vault_value_checker.snapshotValue()))
    print("Vault After", c18(vault_core.totalValue()))
    print("Snapshot change", c18(vault_core.totalValue()-vault_value_checker.snapshotValue()))
    show_transfers(history[-2])
    print(load_from_blockchain())

safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)



# --------------------------------
# Nov 10, 2022 
# 

from world import *
from allocations import *
from ape_safe import ApeSafe

with TemporaryFork():
    print(load_from_blockchain())
    before = vault_core.totalValue()
    beforeOUSD = ousd.totalSupply()
    txs = [
        vault_value_checker.takeSnapshot({"from": STRATEGIST}),
        vault_admin.reallocate(COMP_STRAT, OUSD_META_STRAT, [usdc], [int(3800000 * 1e6)], {'from': STRATEGIST}),
        vault_value_checker.checkLoss(-7607000*1e18, {"from": STRATEGIST}),
    ]
    print("Vault change", c18(vault_core.totalValue() - before))
    print("Snapshot before", c18(vault_value_checker.snapshotValue()))
    print("Vault After", c18(vault_core.totalValue()))
    print("Snapshot change", c18(vault_core.totalValue()-vault_value_checker.snapshotValue()))
    print("OUSD change", c18(ousd.totalSupply()-beforeOUSD))
    print(load_from_blockchain())
    show_transfers(history[-2])
    print("")

safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)





# --------------------------------
# Nov 21, 2022 
# 
from world import *
from allocations import *
from ape_safe import ApeSafe


with TemporaryFork():
    print(load_from_blockchain())
    before = vault_core.totalValue()
    txs = [
        vault_value_checker.takeSnapshot({"from": STRATEGIST}),
        vault_admin.reallocate(OUSD_META_STRAT, COMP_STRAT, [usdc], [int(481000 * 1e6)], {'from': STRATEGIST}),
        vault_value_checker.checkLoss(-480800*1e18, {"from": STRATEGIST}),
    ]
    print("Vault change", c18(vault_core.totalValue() - before))
    print("Snapshot before", c18(vault_value_checker.snapshotValue()))
    print("Vault After", c18(vault_core.totalValue()))
    print("Snapshot change", c18(vault_core.totalValue()-vault_value_checker.snapshotValue()))
    print(load_from_blockchain())
    print("")

safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# Nov 22, 2022 
#

# Due to an accident with `git checkout -f`, the script for today's
# large allocation today was lost.

# --------------------------------
# Nov 23, 2022 
# 

from world import *
from allocations import *
from ape_safe import ApeSafe


with TemporaryFork():
    print(load_from_blockchain())
    before = vault_core.totalValue()
    txs = [
        vault_core.rebase({"from": STRATEGIST}),
        vault_value_checker.takeSnapshot({"from": STRATEGIST}),
        vault_admin.reallocate(COMP_STRAT, OUSD_META_STRAT, [usdc], [1 * int(1e6) * int(1e6)], {'from': STRATEGIST}),
        vault_admin.reallocate(COMP_STRAT, OUSD_META_STRAT, [dai], [1 * int(1e6) * int(1e18)], {'from': STRATEGIST}),
        vault_value_checker.checkDelta(2001418234420763011604962, 2001818234420763011604962, 2001319886861331484075056, 2001719886861331484075056, {"from": STRATEGIST}),
    ]
    
    snapshot = vault_value_checker.snapshots(STRATEGIST)
    print(snapshot)
    vault_change = vault_core.totalValue() - snapshot[0]
    supply_change = ousd.totalSupply() - snapshot[1]

    print("Vault change", c18(vault_change))
    print("Supply change", c18(supply_change))
    print("Profit change", c18(vault_change - supply_change))
    print(vault_change - 500 * int(1e18), vault_change + 1000 * int(1e18), supply_change - 1000 * int(1e18), supply_change + 500 * int(1e18))
    print(load_from_blockchain())
    print("")

safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# Nov 30, 2022 
# 

from world import *
from allocations import *
from ape_safe import ApeSafe


votes = """
    Convex OUSD/3Crv    44.73
    Aave USDT   10.42
    Compound USDT   9.07
    Morpho Compound USDT    6.74
    Morpho Compound DAI 5.39
    Morpho Compound USDC    5.39
    Compound DAI    5.35
    Compound USDC   5.35
    Aave DAI    3.27
    Aave USDC   3.27
    Convex DAI/USDC/USDT    1.02
    Existing Allocation 0
    """

with TemporaryFork():
    before_allocation = with_target_allocations(load_from_blockchain(), votes)
    print(pretty_allocations(before_allocation))
    before = vault_core.totalValue()
    txs = [
        vault_core.rebase({'from': STRATEGIST}),
        vault_value_checker.takeSnapshot({"from": STRATEGIST}),
        
        reallocate(AAVE_STRAT,   MORPHO_COMP_STRAT, [[1_851_000, dai], [78_000, usdt]]),
        reallocate(COMP_STRAT,   MORPHO_COMP_STRAT, [[1_851_000, usdc]]),
        reallocate(COMP_STRAT,   AAVE_STRAT, [[1_183_000, usdc]]),
        reallocate(COMP_STRAT,   OUSD_META_STRAT, [[3_900_000, dai],[4_196_000, usdc]]),

        reallocate(AAVE_STRAT,   CONVEX_STRAT, [[2_622_000, dai]]),
        reallocate(COMP_STRAT,   CONVEX_STRAT, [[1_433_000, dai]]),
        reallocate(CONVEX_STRAT, COMP_STRAT, [[2_412_000, usdt]]),
        reallocate(CONVEX_STRAT, MORPHO_COMP_STRAT, [[2_261_000, usdt]]),
        
        vault_admin.setAssetDefaultStrategy(DAI, COMP_STRAT, {'from': STRATEGIST}),
        vault_value_checker.checkDelta(8095444597380755611167495,8096944597380755611167495,8094868973290731737987818,8096368973290731737987818, {"from": STRATEGIST}),
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
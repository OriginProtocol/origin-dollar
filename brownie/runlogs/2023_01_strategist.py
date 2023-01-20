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


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)



# --------------------------------
# Jan 16, 2022 - Weekly allocation Part 1
# 

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
    Convex OUSD+3Crv    49.66
    Aave USDT   32.04
    Aave DAI    5.01
    Morpho Aave USDT    4.18
    Morpho Compound USDT    4.18
    Aave USDC   3.91
    Convex DAI+USDC+USDT    0.78
    Compound DAI    0.03
    Compound USDC   0.03
    Compound USDT   0.03
    Convex LUSD+3Crv    0.03
    Morpho Aave DAI 0.03
    Morpho Aave USDC    0.03
    Morpho Compound DAI 0.03
    Morpho Compound USDC    0.03
    Existing Allocation 0
    """

with TemporaryFork():
    before_allocation = with_target_allocations(load_from_blockchain(), votes)
    before_votes = before_allocation
    print(pretty_allocations(before_allocation))
    before = vault_core.totalValue()
    
    txs = []

    txs.extend(auto_take_snapshot())
    
    # Consolidate Stables
    allocation = with_target_allocations(load_from_blockchain(), before_votes)
    txs.extend(auto_consolidate_stables(allocation, consolidation="AAVE"))

    # Pull from strats
    txs.append(reallocate(CONVEX_STRAT, AAVE_STRAT, [[60_000, dai], [60_000, usdc], [60_000, usdt]]))
    
    # Push to strats
    # txs.append(reallocate(AAVE_STRAT, OUSD_META_STRAT, [[520_000, dai], [780_000, usdc], [1_900_000, usdt]]))

    # # Distribute Stables
    # allocation = with_target_allocations(load_from_blockchain(), before_votes)
    # txs.extend(auto_distribute_stables(allocation, consolidation="AAVE", min_move=50_000))

    txs.append(vault_admin.setAssetDefaultStrategy(DAI, AAVE_STRAT, {'from':STRATEGIST}))
    txs.append(vault_admin.setAssetDefaultStrategy(USDC, AAVE_STRAT, {'from':STRATEGIST}))
    txs.append(vault_admin.setAssetDefaultStrategy(USDT, AAVE_STRAT, {'from':STRATEGIST}))

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


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)



# --------------------------------
# Jan 16, 2022 - Weekly allocation Part 2
# 

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
    Convex OUSD+3Crv    49.66
    Aave USDT   32.04
    Aave DAI    5.01
    Morpho Aave USDT    4.18
    Morpho Compound USDT    4.18
    Aave USDC   3.91
    Convex DAI+USDC+USDT    0.78
    Compound DAI    0.03
    Compound USDC   0.03
    Compound USDT   0.03
    Convex LUSD+3Crv    0.03
    Morpho Aave DAI 0.03
    Morpho Aave USDC    0.03
    Morpho Compound DAI 0.03
    Morpho Compound USDC    0.03
    Existing Allocation 0
    """

with TemporaryFork():
    before_allocation = with_target_allocations(load_from_blockchain(), votes)
    before_votes = before_allocation
    print(pretty_allocations(before_allocation))
    before = vault_core.totalValue()
    
    txs = []

    txs.extend(auto_take_snapshot())
    
    # Consolidate Stables
    # allocation = with_target_allocations(load_from_blockchain(), before_votes)
    # txs.extend(auto_consolidate_stables(allocation, consolidation="AAVE"))

    # Pull from strats
    # txs.append(reallocate(CONVEX_STRAT, AAVE_STRAT, [[60_000, dai], [60_000, usdc], [60_000, usdt]]))
    
    # Push to strats
    txs.append(reallocate(AAVE_STRAT, OUSD_META_STRAT, [[520_000, dai], [780_000, usdc], [1_900_000, usdt]]))

    # # Distribute Stables
    allocation = with_target_allocations(load_from_blockchain(), before_votes)
    txs.extend(auto_distribute_stables(allocation, consolidation="AAVE", min_move=50_000))

    # txs.append(vault_admin.setAssetDefaultStrategy(DAI, AAVE_STRAT, {'from':STRATEGIST}))
    # txs.append(vault_admin.setAssetDefaultStrategy(USDC, AAVE_STRAT, {'from':STRATEGIST}))
    # txs.append(vault_admin.setAssetDefaultStrategy(USDT, AAVE_STRAT, {'from':STRATEGIST}))

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


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# Jan 17, 2022 - Weekly allocation Part 3
# 

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
    Convex OUSD+3Crv    49.66
    Aave USDT   32.04
    Aave DAI    5.01
    Morpho Aave USDT    4.18
    Morpho Compound USDT    4.18
    Aave USDC   3.91
    Convex DAI+USDC+USDT    0.78
    Compound DAI    0.03
    Compound USDC   0.03
    Compound USDT   0.03
    Convex LUSD+3Crv    0.03
    Morpho Aave DAI 0.03
    Morpho Aave USDC    0.03
    Morpho Compound DAI 0.03
    Morpho Compound USDC    0.03
    Existing Allocation 0
    """

with TemporaryForkWithVaultStats(votes):
    txs = []
    txs.append(reallocate(AAVE_STRAT, MORPHO_AAVE_STRAT, [[9_000, dai], [10_000, usdc]]))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# Jan 20, 2022 - Move ownership of new governance to new governance
# 

from world import *
from allocations import *
from ape_safe import ApeSafe

veogv_proxy = Contract.from_abi('veogv_proxy', veogv, rewards_source.abi)
rewards_source_impl = Contract.from_abi('rewards_source_impl', '0xE82191eF8996852a802aaE509993770480F9CA2C', rewards_source.abi)

with TemporaryFork():
    # Create old governance internal transactions
    print(ogv.owner())
    print(veogv_proxy.governor())
    print(rewards_source.governor())
    print(rewards_source_impl.governor())
    txs = [
        ogv.transferOwnership(TIMELOCK, {'from': GOV_MULTISIG}),
        veogv_proxy.transferGovernance(TIMELOCK, {'from': GOV_MULTISIG}),
        rewards_source.transferGovernance(TIMELOCK, {'from': GOV_MULTISIG}),
        rewards_source_impl.transferGovernance(TIMELOCK, {'from': GOV_MULTISIG}),
    ]
    print(ogv.owner())
    print(veogv_proxy.governor())
    print(rewards_source.governor())
    print(rewards_source_impl.governor())

    # # Test Claim Ownership
    accept_txs = []
    with TemporaryFork():
        for x in [veogv_proxy, rewards_source, rewards_source_impl]:
            accept_txs.append(x.claimGovernance({'from': TIMELOCK}))

    governor_five.propose(
        [x.receiver for x in accept_txs],
        [0 for x in accept_txs],
        ['claimGovernance()' for x in accept_txs],
        [x.input[10:] for x in accept_txs],
        "Claim governance on governance system contracts\n\nOUSD governance contracts have been owned by the OUSD 5 of 8 multi-sig. Now that these governance contracts have been proven out, it's time for them to be directly owned by the community.",
        {'from': GOV_MULTISIG }
    )

    print("Raw proposal:")
    print(history[-1].receiver)
    print(history[-1].input)
    print(history[-1].events)
    proposal_id = history[-1].events['ProposalCreated'][0]['proposalId']
    print(proposal_id)

    print("...Simulating vote")
    chain.mine()
    governor_five.castVote(proposal_id, 1, {'from': GOV_MULTISIG})

    print("...Simulating voting time, going to take time")
    chain.mine(governor_five.votingPeriod() + 1)

    print("...Simulating queue")
    governor_five.queue(proposal_id, {'from': GOV_MULTISIG})
    chain.mine(timedelta=2*24*60*60+2)

    print("...Simulating execution")
    governor_five.execute(proposal_id, {'from': GOV_MULTISIG})

    print(ogv.owner())
    print(veogv_proxy.governor())
    print(rewards_source.governor())
    print(rewards_source_impl.governor())

safe = ApeSafe(GOV_MULTISIG)
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)





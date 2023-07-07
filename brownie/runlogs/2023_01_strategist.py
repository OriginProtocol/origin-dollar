# --------------------------------
# Jan 6, 2023 - Weekly allocation
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
# Jan 16, 2023 - Weekly allocation Part 1
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
# Jan 16, 2023 - Weekly allocation Part 2
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
# Jan 17, 2023 - Weekly allocation Part 3
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
# Jan 20, 2023 - Move ownership of new governance to new governance
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
        "Claim ownership of governance system contracts\n\nOUSD governance contracts have been owned by the OUSD 5 of 8 multi-sig. Now that these governance contracts have been proven out, it's time for them to be directly owned by the community.",
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
    governor_five.execute(proposal_id, {'from': STRATEGIST})

    print(ogv.owner())
    print(veogv_proxy.governor())
    print(rewards_source.governor())
    print(rewards_source_impl.governor())

safe = ApeSafe(GOV_MULTISIG)
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# Jan 20, 2023 - Weekly reallocation
# 

# console.log(Array(...$('.space-y-3').querySelectorAll('.text-skin-link.flex')).map((x)=>{y=x.innerText.split("\n"); return [y[0], y[1].split('veOGV')[1]].join("\t")}).join("\n"))

from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
    Convex OUSD+3Crv    44.27
    Morpho Aave USDT    34.44
    Morpho Aave DAI 3.94
    Morpho Aave USDC    3.94
    Convex DAI+USDC+USDT    3.12
    Morpho Compound USDT    2.86
    Morpho Compound DAI 2.43
    Morpho Compound USDC    2.43
    Convex LUSD+3Crv    0.27
    Aave DAI    0.1
    Aave USDC   0.1
    Aave USDT   0.1
    Compound DAI    0.1
    Compound USDC   0.1
    Compound USDT   0.1
    Existing Allocation 1.67
    """

with TemporaryForkWithVaultStats(votes) as s:
    before_votes = with_target_allocations(load_from_blockchain(), votes)
    txs = []
    txs.extend(auto_take_snapshot())
    
    # Consolidate Stables
    allocation = with_target_allocations(load_from_blockchain(), before_votes)
    txs.extend(auto_consolidate_stables(allocation, consolidation="MORPHO_AAVE"))

    # Pull from strats
    txs.append(reallocate(OUSD_META_STRAT, MORPHO_COMP_STRAT, [[600_000, dai], [900_000, usdc]]))
    
    # Push to strats
    txs.append(reallocate(MORPHO_AAVE_STRAT, CONVEX_STRAT, [[800_000, usdt]]))

    # # Distribute Stables
    allocation = with_target_allocations(load_from_blockchain(), before_votes)
    txs.extend(auto_distribute_stables(allocation, consolidation="MORPHO_AAVE", min_move=200_000))

    txs.append(vault_admin.setAssetDefaultStrategy(DAI, MORPHO_AAVE_STRAT, {'from':STRATEGIST}))
    txs.append(vault_admin.setAssetDefaultStrategy(USDC, MORPHO_AAVE_STRAT, {'from':STRATEGIST}))
    txs.append(vault_admin.setAssetDefaultStrategy(USDT, MORPHO_AAVE_STRAT, {'from':STRATEGIST}))

    txs.extend(auto_check_snapshot())

print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))



safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# Jan 26, 2023 - Weekly allocation
# (new style protoype, not run)
# 

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

# Temp for local fork testing
whale = accounts.at(BIGWALLET, force=True)
unlock(whale.address)
whale.transfer(STRATEGIST, 1e18)

votes = """
    Convex OUSD+3Crv    35.3%
    Morpho Compound USDC    32.09%
    Morpho Compound USDT    12.15%
    Morpho Aave USDT    11.96%
    Morpho Aave USDC    4.04%
    Aave DAI    0.24%
    Aave USDC   0.24%
    Aave USDT   0.24%
    Compound DAI    0.19%
    Compound USDC   0.19%
    Compound USDT   0.19%
    Convex LUSD+3Crv    0.19%
    Existing Allocation 0%
    Convex DAI+USDC+USDT    0%
    Morpho Aave DAI 3%
    Morpho Compound DAI 0%
    """

with TemporaryForkWithVaultStats(votes):
    before_votes = with_target_allocations(load_from_blockchain(), votes)
    txs = []
    txs.extend(auto_take_snapshot())
    
    # From
    from_strat(MORPHO_AAVE_STRAT,[[380_000, dai], [8_124_000, usdt]])
    from_strat(MORPHO_COMP_STRAT,[[864_000, dai]])
    from_strat(OUSD_META_STRAT,[[3_000_000, usdc]])
    
    # Convert
    to_strat(CONVEX_STRAT,[[1_244_000, dai], [4_905_000, usdt]])
    from_strat(CONVEX_STRAT,[[7_149_000, usdc]])
    
    # To
    to_strat(MORPHO_COMP_STRAT,[[10_149_000, usdc], [3_271_000, usdt]])
    txs.append(vault_admin.setAssetDefaultStrategy(usdc, MORPHO_COMP_STRAT, {'from':STRATEGIST}))
    txs.append(vault_admin.setAssetDefaultStrategy(usdt, MORPHO_COMP_STRAT, {'from':STRATEGIST}))

    txs.extend(auto_check_snapshot())
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# Jan 30, 2023 - Weekly allocation
# 

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
    Convex OUSD+3Crv    35.3%
    Morpho Compound USDC    32.09%
    Morpho Compound USDT    12.15%
    Morpho Aave USDT    11.96%
    Morpho Aave USDC    4.04%
    Aave DAI    0.24%
    Aave USDC   0.24%
    Aave USDT   0.24%
    Compound DAI    0.19%
    Compound USDC   0.19%
    Compound USDT   0.19%
    Convex LUSD+3Crv    0.19%
    Existing Allocation 0%
    Convex DAI+USDC+USDT    0%
    Morpho Aave DAI 3%
    Morpho Compound DAI 0%
    """

with TemporaryForkWithVaultStats(votes):
    before_votes = with_target_allocations(load_from_blockchain(), votes)
    txs = []
    txs.extend(auto_take_snapshot())

    txs.append(reallocate(MORPHO_AAVE_STRAT, MORPHO_COMP_STRAT, [[3_271_000, usdt]]))
    txs.append(reallocate(MORPHO_COMP_STRAT, MORPHO_AAVE_STRAT, [[864_000, dai]]))

    # Swap
    txs.append(reallocate(MORPHO_AAVE_STRAT, CONVEX_STRAT, [[1_244_000, dai], [4_852_000, usdt]]))
    txs.append(reallocate(CONVEX_STRAT, MORPHO_COMP_STRAT, [[7_165_000, usdc]]))

    # From meta
    txs.append(reallocate(OUSD_META_STRAT, MORPHO_COMP_STRAT, [[3_330_000, usdc]]))

    txs.extend(auto_check_snapshot())
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# Jan 31, 2023 - Transfer OUSD
# 

from world import *

def make_governable(pair):
  return Contract.from_abi(pair[1], pair[0], buyback.abi)

def parse_contracts(s):
  out = []
  for line in s.split("\n"):
    tokens = line.split("  ")
    if len(tokens) == 2:
      g = make_governable(tokens)
      out.append(g)
  return out


transfer_contracts = parse_contracts("""
0x6C5cdfB47150EFc52072cB93Eea1e0F123529748  Buyback
0x7294CD3C3eb4097b03E1A61EB2AD280D3dD265e6  Buyback
0x77314EB392b2be47C014cde0706908b3307Ad6a9  Buyback
0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86  OUSDProxy
0xE75D77B1865Ae93c7eaa3040B038D7aA7BC02F70  VaultProxy
0x9c459eeb3FA179a40329b81C1635525e9A0Ef094  InitializeGovernedUpgradeabilityProxy
0x21Fb5812D70B3396880D30e90D9e5C1202266c89  HarvesterProxy
0x80C898ae5e56f888365E235CeB8CEa3EB726CB58  HarvesterProxy
0x5e3646A1Db86993f73E6b74A57D8640B69F7e259  InitializeGovernedUpgradeabilityProxy
0xEA2Ef2e2E5A749D4A66b41Db9aD85a38Aa264cb3  ConvexStrategyProxy
0x89Eb88fEdc50FC77ae8a18aAD1cA0ac27f777a90  ConvexUSDDMetaStrategyProxy
0x5A4eEe58744D1430876d5cA93cAB5CcB763C037D  MorphoCompoundStrategyProxy
0x7A192DD9Cc4Ea9bdEdeC9992df74F1DA55e60a19  ConvexLUSDMetaStrategyProxy
0x79F2188EF9350A1dC11A062cca0abE90684b0197  MorphoAaveStrategyProxy
0xD2af830E8CBdFed6CC11Bab697bB25496ed6FA62  wOUSDProxy
0x501804B374EF06fa9C427476147ac09F1551B9A0  InitializeGovernedUpgradeabilityProxy
""")

accept_only_contracts = parse_contracts("""
0x997c35A0bf8E21404aE4379841E0603C957138c3  VaultCore
""")

# Another day: 0x52BEBd3d7f37EC4284853Fd5861Ae71253A7F428  OldTimelock

all_contracts = [*transfer_contracts, *accept_only_contracts]

# Pre-transfer old vault core
g = make_governable(['0x997c35A0bf8E21404aE4379841E0603C957138c3', 'VaultCore'])
g.transferGovernance(TIMELOCK, {'from': g.governor()})


for c in all_contracts:
  print(c.governor(), c._name)


# --- Old governor

with TemporaryFork():
    gov_txs = []
    for c in transfer_contracts:
      gov_txs.append(c.transferGovernance(TIMELOCK, {'from':GOVERNOR}))

governor.propose(
        [x.receiver for x in gov_txs],
        ['transferGovernance(address)' for x in gov_txs],
        [x.input[10:] for x in gov_txs],
        "Transfer governance of OUSD to veOGV governance system",
        {'from': GOV_MULTISIG }
    )

print(history[-1].receiver)
print(history[-1].input)
print(history[-1].events)
proposal_id = history[-1].events['ProposalCreated'][0]['id']
print(proposal_id)

sim_governor_execute(proposal_id)


# --- New governor

accept_txs = []
with TemporaryFork():
    for c in all_contracts:
      accept_txs.append(c.claimGovernance({'from': TIMELOCK}))

governor_five.propose(
        [x.receiver for x in accept_txs],
        [0 for x in accept_txs],
        ['claimGovernance()' for x in accept_txs],
        ['' for x in accept_txs],
        "Claim governance of OUSD contracts\n\nAll OUSD governance contracts will be owned by the veOGV governance system.",
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


for c in all_contracts:
  print(c.governor(), c._name)
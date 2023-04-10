
# --------------------------------
# Feb 3, 2023 - Weekly allocation
# 

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
    Convex OUSD+3Crv  42.55%
    Morpho Aave USDT    25.74%
    Morpho Compound USDC    14%
    Morpho Aave USDC    9.62%
    Morpho Compound USDT    3.71%
    Morpho Aave DAI 3.00%
    Morpho Compound DAI 0.57%
    Convex DAI+USDC+USDT    0.31%
    Convex LUSD+3Crv    0.21%
    Aave DAI    0.05%
    Aave USDC   0.05%
    Aave USDT   0.05%
    Compound DAI    0.05%
    Compound USDC   0.05%
    Compound USDT   0.05%
    Existing Allocation 0%
    """

with TemporaryForkWithVaultStats(votes):
    before_votes = with_target_allocations(load_from_blockchain(), votes)
    txs = []
    txs.extend(auto_take_snapshot())

    txs.append(reallocate(MORPHO_COMP_STRAT, MORPHO_AAVE_STRAT, [[2_000_000, usdc],[3_000_000, usdt]]))
    
    # # Swap
    txs.append(reallocate(MORPHO_COMP_STRAT, OUSD_META_STRAT, [[4_500_000, usdc]]))
    txs.append(reallocate(OUSD_META_STRAT, MORPHO_AAVE_STRAT, [[1_700_000, usdt]]))

    txs.extend(auto_check_snapshot())
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)



# --------------------------------
# Feb 7, 2023 - OUSD Governance Proposal
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

all_contracts = [*transfer_contracts, *accept_only_contracts]


for c in all_contracts:
  print(c.governor(), c._name)

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



# --------------------------------
# Feb 10, 2023 - Weekly allocation
# 

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
    Convex OUSD+3Crv  43.35%
    Morpho Aave USDT    20.22%
    Morpho Compound DAI 11.96%
    Morpho Compound USDC    11.96%
    Morpho Compound USDT    3%
    Convex DAI+USDC+USDT    2.99%
    Morpho Aave DAI 1.91%
    Morpho Aave USDC    1.83%
    Convex LUSD+3Crv    0.29%
    Aave USDT   0.2%
    Compound USDT   0.2%
    Aave DAI    0.2%
    Aave USDC   0.2%
    Compound DAI    0.2%
    Compound USDC   0.2%
    Existing Allocation 1.33%
    """

with TemporaryForkWithVaultStats(votes):
    before_votes = with_target_allocations(load_from_blockchain(), votes)
    txs = []
    txs.extend(auto_take_snapshot())

    # Move
    txs.append(reallocate(MORPHO_COMP_STRAT, OUSD_META_STRAT, [[550_000, usdc]]))
    txs.append(reallocate(MORPHO_AAVE_STRAT, MORPHO_COMP_STRAT, [[400_000, dai]]))
    
    # Swap
    txs.append(reallocate(MORPHO_AAVE_STRAT, CONVEX_STRAT, [[2_642_000, usdc], [1_800_000, usdt]]))
    txs.append(reallocate(CONVEX_STRAT, MORPHO_COMP_STRAT, [[3_400_000, dai]]))

    # Defaults
    txs.append(vault_admin.setAssetDefaultStrategy(DAI, MORPHO_COMP_STRAT, {'from': STRATEGIST}))
    txs.append(vault_admin.setAssetDefaultStrategy(USDC, MORPHO_COMP_STRAT, {'from': STRATEGIST}))
    txs.append(vault_admin.setAssetDefaultStrategy(USDT, MORPHO_AAVE_STRAT, {'from': STRATEGIST}))

    txs.extend(auto_check_snapshot())
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# Feb 15, 2023 - Gov Five Proposal for new reallocation systems
# 

from world import *

old_proposal = governor.getActions(44)
old_receivers = old_proposal[0]
old_sigs = old_proposal[1]
old_data = old_proposal[2]

governor_five.propose(
        old_receivers,
        [0 for x in old_receivers],
        old_sigs,
        old_data,
        """Vault Direct Reallocations

Currently all vault allocations must move from strategy to strategy. This can cost up to twice the needed gas costs in weekly reallocations, and is much more work to automate.

This proposal will allow funds to be moved directly to and from the vault.

Code PR:
https://github.com/OriginProtocol/origin-dollar/pull/1071

Deploy PR:
https://github.com/OriginProtocol/origin-dollar/pull/1228

        """,
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


# Testing
vault_admin.depositToStrategy(COMP_STRAT, [usdt], [100*1e6], {'from': STRATEGIST})


# --------------------------------
# Feb 16, 2023 - Weekly allocation
# 

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
    Convex OUSD+3Crv    48.74%
    Morpho Aave USDT    19.34%
    Morpho Compound USDT    15.57%
    Convex DAI+USDC+USDT    2.92%
    Existing Allocation 3.61%
    Morpho Aave USDC    2.23%
    Morpho Aave DAI 2.17%
    Morpho Compound USDC    1.7%
    Morpho Compound DAI 1.65%
    Convex LUSD+3Crv    0.30%
    Aave DAI    0.29%
    Aave USDC   0.29%
    Aave USDT   0.29%
    Compound DAI    0.29%
    Compound USDC   0.29%
    Compound USDT   0.29%
    """

with TemporaryForkWithVaultStats(votes):
    before_votes = with_target_allocations(load_from_blockchain(), votes)

    txs = []

    txs.append(vault_core.allocate({'from':STRATEGIST}))

    txs.extend(auto_take_snapshot())

    # Move
    txs.append(reallocate(MORPHO_COMP_STRAT, OUSD_META_STRAT, [[2_235_000, dai]]))
    
    # Swap
    txs.append(reallocate(MORPHO_COMP_STRAT, CONVEX_STRAT, [[2_800_000, usdc]]))
    txs.append(reallocate(CONVEX_STRAT, MORPHO_COMP_STRAT, [[2_800_000, usdt]]))

    # Defaults
    # N/a

    txs.extend(auto_check_snapshot())
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)

# --------------------------------
# Feb 21, 2023 - Gov Five Proposal for auto delegates
# 

from world import *



with TemporaryFork():
    governor_five.propose(
            ['0x0c4576ca1c365868e162554af8e385dc3e7c66d9'],
            [0],
            ['upgradeTo(address)'],
            ['0x000000000000000000000000e61110663334794aba03c349c621a075dc590a42'],
            """Automatic Voting Delegation for OGV Staking

Currently users must take a seperate step to delegate OGV to themselves in order to vote, and this must be done before a vote begins. This suprises many users who expect to be able to vote if they have veOGV.

This contract change will automaticly delegate a user's own votes to themselves the first or next time they stake or extend.

Code PR:
https://github.com/OriginProtocol/ousd-governance/pull/367

Deploy PR:
https://github.com/OriginProtocol/ousd-governance/pull/378

            """,
            {'from': GOV_MULTISIG }
        )

    print("Raw proposal:")
    print(history[-1].receiver)
    print(history[-1].input)
    # print(history[-1].events)
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


    # # Testing
    USER = '....'
    veogv.collectRewards({'from': USER})
    print(c18(ogv.balanceOf(USER)))
    veogv.stake(ogv.balanceOf(USER), 4*365*24*60*60, {'from':USER})
    print(c18(ogv.balanceOf(USER)))



# --------------------------------
# Feb 28, 2023 - Weekly allocation
# 

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
Convex OUSD+3Crv    57.02%
Morpho Aave USDT    14.13%
Morpho Compound USDT    10.55%
Morpho Aave DAI 4.07%
Morpho Aave USDC    4.07%
Convex DAI+USDC+USDT    2.5%
Morpho Compound USDC    2.44%
Morpho Compound DAI 2.43%
Convex LUSD+3Crv    0.25%
Aave DAI    0.16%
Aave USDC   0.16%
Aave USDT   0.16%
Compound DAI    0.02%
Compound USDC   0.02%
Compound USDT   0.02%
Existing Allocation 2%
    """

with TemporaryForkWithVaultStats(votes):
    before_votes = with_target_allocations(load_from_blockchain(), votes)

    txs = []
    txs.extend(auto_take_snapshot())

    # From
    txs.append(vault_admin.withdrawAllFromStrategy(AAVE_STRAT, {'from': STRATEGIST}))
    txs.append(from_strat(MORPHO_COMP_STRAT, [[751_000, dai], [2_733_000, usdc], [640_000, usdt]]))
    txs.append(from_strat(MORPHO_AAVE_STRAT, [[2_565_000, usdt]]))
    txs.append(from_strat(CONVEX_STRAT, [[200_000, dai]]))
        
    # Swap

    # To
    txs.append(to_strat(MORPHO_AAVE_STRAT, [[558_000, dai], [646_000, usdc]]))
    txs.append(to_strat(OUSD_METASTRAT, [[458_472, dai], [2_146_316, usdc], [3_443_493, usdt]]))


    # Defaults
    txs.append(vault_admin.setAssetDefaultStrategy(dai, MORPHO_AAVE_STRAT,{'from':STRATEGIST}))
    txs.append(vault_admin.setAssetDefaultStrategy(usdc, MORPHO_AAVE_STRAT,{'from':STRATEGIST}))

    txs.extend(auto_check_snapshot())
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs, safe_nonce=165)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)
# --------------------------------
# Oct ?, 2022 Governance Transfers
# 


from world import * 

NEW_OWNER = '0x35918cde7233f2dd33fa41ae3cb6ae0e42e0e69f'
OLD_GOVERNOR = '0x830622bdd79cc677ee6594e20bbda5b26568b781'

oldgov = Contract.from_explorer(OLD_GOVERNOR)

contracts = [
  '0x9C94df9d594BA1eb94430C006c269C314B1A8281',  # CompensationClaims
  '0xD5433168Ed0B1F7714819646606DB509D9d8EC1f',  # CompoundStrategyProxy
  '0x9f2b18751376cF6a3432eb158Ba5F9b1AbD2F7ce',  # AAVEStrategyProxy
  '0x3c5fe0a3922777343CBD67D3732FCdc9f2Fa6f2F',  # ThreePoolStrategyProxy
]

txs = []
with TemporaryFork():
	for x in contracts:
		contract = Contract.from_explorer(x)
		txs.append(contract.transferGovernance(NEW_OWNER, {'from': OLD_GOVERNOR}))

oldgov.propose(
	[x.receiver for x in txs],
	['transferGovernance(address)' for x in txs],
	[x.input[10:] for x in txs],
	"Transfer Governance",
	{'from': GOV_MULTISIG }
)

print(history[-1].receiver)
print(history[-1].input)

# Test
oldgov.queue(9, {'from': GOV_MULTISIG})
chain.mine(timedelta=2*24*60*60+2)
oldgov.execute(9, {'from': GOV_MULTISIG})

for x in contracts:
  contract = Contract.from_explorer(x)
  contract.claimGovernance({'from': NEW_OWNER})
  print(contract.governor())


# --------------------------------
# Oct 12, 2022 Governance Transfers
# Migrate from old time lock
# 

from world import * 

NEW_OWNER = '0x35918cde7233f2dd33fa41ae3cb6ae0e42e0e69f'
OLD_GOVERNOR = '0x8a5ff78bfe0de04f5dc1b57d2e1095be697be76e'
OLD_TIMELOCK = '0x52bebd3d7f37ec4284853fd5861ae71253a7f428'
OLD_GOV_MULTI_SIG = "0xe011fa2a6df98c69383457d87a056ed0103aa352"

oldgov = Contract.from_explorer(OLD_GOVERNOR)

contracts = [
  '0x12115A32a19e4994C2BA4A5437C22CEf5ABb59C3',  # 	CompoundStrategyProxy
  '0x47211B1D1F6Da45aaEE06f877266E072Cf8BaA74',  # 	CompoundStrategyProxy
  '0x051CaEFA90aDf261B8E8200920C83778b7B176B6',  # 	InitializeGovernedUpgradeabilityProxy
  '0x277e80f3E14E7fB3fc40A9d6184088e0241034bD',  # 	InitializeGovernedUpgradeabilityProxy
  '0x4d4f5e7a1FE57F5cEB38BfcE8653EFFa5e584458',  # 	MixOracle
  '0xe40e09cD6725E542001FcB900d9dfeA447B529C0',  # 	ThreePoolStrategyProxy
]

txs = []
with TemporaryFork():
	for x in contracts:
		contract = Contract.from_explorer(x)
		txs.append(contract.transferGovernance(NEW_OWNER, {'from': OLD_TIMELOCK}))

oldgov.propose(
	[x.receiver for x in txs],
	[0 for x in txs],
	['transferGovernance(address)' for x in txs],
	[x.input[10:] for x in txs],
	"Transfer Governance",
	{'from': OLD_GOV_MULTI_SIG }
)

print("Raw proposal:")
print(history[-1].receiver)
print(history[-1].input)

# # Test
oldgov.queue(28, {'from': OLD_GOV_MULTI_SIG})
chain.mine(timedelta=2*24*60*60+2)
oldgov.execute(28, {'from': OLD_GOV_MULTI_SIG})

for x in contracts:
  contract = Contract.from_explorer(x)
  contract.claimGovernance({'from': NEW_OWNER})
  print(contract.governor())


# --------------------------------
# Oct 12, 2022 Governance Transfers
# Move old timelock ownership

from world import * 

NEW_OWNER = '0x35918cde7233f2dd33fa41ae3cb6ae0e42e0e69f'
OLD_GOVERNOR = '0x8a5ff78bfe0de04f5dc1b57d2e1095be697be76e'
OLD_TIMELOCK = '0x52bebd3d7f37ec4284853fd5861ae71253a7f428'
OLD_GOV_MULTI_SIG = "0xe011fa2a6df98c69383457d87a056ed0103aa352"

oldtimelock = Contract.from_explorer(OLD_TIMELOCK)
oldgov = Contract.from_explorer(OLD_GOVERNOR)

txs = []
with TemporaryFork():
	txs.append(oldtimelock.setPendingAdmin(NEW_OWNER, {'from': oldtimelock}))

oldgov.propose(
	[x.receiver for x in txs],
	[0 for x in txs],
	['setPendingAdmin(address)' for x in txs],
	[x.input[10:] for x in txs],
	"Transfer timelock ownership",
	{'from': OLD_GOV_MULTI_SIG }
)

print("Raw proposal:")
print(history[-1].receiver)
print(history[-1].input)

# # Test
oldgov.queue(29, {'from': OLD_GOV_MULTI_SIG})
chain.mine(timedelta=2*24*60*60+2)
oldgov.execute(29, {'from': OLD_GOV_MULTI_SIG})

print(oldtimelock.pendingAdmin())




# --------------------------------
# Oct 17, 2022 OGV Buyback
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
    after = ogv.balanceOf(REWARDS)
    amount_no_mev = after - before

print("Target buyback amount %s OUSD for %s OGV"%(c18(BUYBACK_AMOUNT), c18(amount_no_mev)))
print("Target price $%f"%(BUYBACK_AMOUNT / amount_no_mev))
print("Min amount %s OGV"%(c18(int(amount_no_mev*MIN_PERCENT_AFTER_SLIPPAGE))))

# Actual Swap TX
with TemporaryFork():
	txs = [
	    buyback.swapNow(BUYBACK_AMOUNT, int(amount_no_mev*MIN_PERCENT_AFTER_SLIPPAGE), {'from': STRATEGIST})
	]
	print(show_transfers(history[-1]))

# Send
safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# Oct 26, 2022 Accept goverance on old contracts
# 

from world import *

newgov = Contract.from_explorer("0x3cdD07c16614059e66344a7b579DAB4f9516C0b6")

old_contracts = [
  "0x9C94df9d594BA1eb94430C006c269C314B1A8281",  # CompensationClaims
  "0xD5433168Ed0B1F7714819646606DB509D9d8EC1f",  # CompoundStrategyProxy
  "0x9f2b18751376cF6a3432eb158Ba5F9b1AbD2F7ce",  # InitializeGovernedUpgradeabilityProxy (DAI Aave Strategy)
  "0x3c5fe0a3922777343CBD67D3732FCdc9f2Fa6f2F",  # ThreePoolStrategyProxy
  "0x48Cf14DeA2f5dD31c57218877195913412D3278A",  # VaultCore
  "0x12115A32a19e4994C2BA4A5437C22CEf5ABb59C3",  # CompoundStrategyProxy
  "0x47211B1D1F6Da45aaEE06f877266E072Cf8BaA74",  # CompoundStrategyProxy
  "0x051CaEFA90aDf261B8E8200920C83778b7B176B6",  # InitializeGovernedUpgradeabilityProxy (DAI Aave Strategy)
  "0x277e80f3E14E7fB3fc40A9d6184088e0241034bD",  # InitializeGovernedUpgradeabilityProxy (Curve  Strategy)
  "0x4d4f5e7a1FE57F5cEB38BfcE8653EFFa5e584458",  # MixOracle
  "0xe40e09cD6725E542001FcB900d9dfeA447B529C0",  # ThreePoolStrategyProxy
]

txs = []

with TemporaryFork():
	for address in old_contracts:
		contract = Contract.from_explorer(address)
		txs.append(contract.claimGovernance({'from': newgov.timelock()}))
		print(contract.governor())


newgov.propose(
	[x.receiver for x in txs],
	[0 for x in txs],
	['claimGovernance()' for x in txs],
	[x.input[10:] for x in txs],
	"Claim governance on old contracts\n\nMoves a selection of old contracts from old goverance to the new.",
	{'from': GOV_MULTISIG }
)

print("Raw proposal:")
print(history[-1].receiver)
print(history[-1].input)
print(history[-1].events)
proposal_id = history[-1].events['ProposalCreated'][0]['proposalId']
print(proposal_id)



# # Test


newgov.queue(proposal_id, {'from': OLD_GOV_MULTI_SIG})
chain.mine(timedelta=2*24*60*60+2)
newgov.execute(proposal_id, {'from': OLD_GOV_MULTI_SIG})

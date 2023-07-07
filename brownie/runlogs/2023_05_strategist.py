# --------------------------------
# May 16, 2023 - OETH AMO Deposit
# --------------------------------


from world import *


vvc = load_contract("OETHVaultValueChecker", "0x31fd8618379d8e473ec2b1540b906e8e11d2a99b")
AMO = '0x1827F9eA98E0bf96550b2FC20F7233277FcD7E63'


txs = []
with TemporaryFork():
  # Before
  txs.append(vault_oeth_core.rebase({'from':STRATEGIST}))
  txs.append(vvc.takeSnapshot({'from':STRATEGIST}))

  # Strategist
  txs.append(vault_oeth_admin.depositToStrategy(AMO, [weth], [12*1e18], {'from': STRATEGIST}))

  #After
  vault_change = vault_oeth_core.totalValue() - vvc.snapshots(STRATEGIST)[0]
  supply_change = oeth.totalSupply() - vvc.snapshots(STRATEGIST)[1]
  profit = vault_change - supply_change
  txs.append(vvc.checkDelta(profit, (0.1 * 10**18), vault_change, (1 * 10**18), {'from': STRATEGIST}))
  print("-----")
  print("Profit", "{:.6f}".format(profit / 10**18), profit)
  print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
  print("-----")
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


from ape_safe import ApeSafe
safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)



# --------------------------------
# May 16, 2023 - OETH Harvest Test
# --------------------------------
from world import *
AMO = '0x1827F9eA98E0bf96550b2FC20F7233277FcD7E63'

before = weth.balanceOf(STRATEGIST)

booster = Contract.from_explorer("0xF403C135812408BFbE8713b5A23a04b3D48AAE31")
booster.earmarkRewards(174, {'from': STRATEGIST})

oeth_harvester = load_contract('harvester', "0x0D017aFA83EAce9F10A8EC5B6E13941664A6785C")
oeth_harvester.harvestAndSwap(AMO, STRATEGIST, {'from': STRATEGIST})

print("Fee", (weth.balanceOf(STRATEGIST)-before) / 1e18)


# --------------------------------
# May 17, 2023 - OETH AMO Deposit
# --------------------------------


from world import *


vvc = load_contract("OETHVaultValueChecker", "0x31fd8618379d8e473ec2b1540b906e8e11d2a99b")
AMO = '0x1827F9eA98E0bf96550b2FC20F7233277FcD7E63'


txs = []
with TemporaryFork():
  # Before
  txs.append(vault_oeth_core.rebase({'from':STRATEGIST}))
  txs.append(vvc.takeSnapshot({'from':STRATEGIST}))

  # Strategist
  txs.append(vault_oeth_admin.depositToStrategy(AMO, [weth], [120*1e18], {'from': STRATEGIST}))

  #After
  vault_change = vault_oeth_core.totalValue() - vvc.snapshots(STRATEGIST)[0]
  supply_change = oeth.totalSupply() - vvc.snapshots(STRATEGIST)[1]
  profit = vault_change - supply_change
  txs.append(vvc.checkDelta(profit, (0.1 * 10**18), vault_change, (1 * 10**18), {'from': STRATEGIST}))
  print("-----")
  print("Profit", "{:.6f}".format(profit / 10**18), profit)
  print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
  print("-----")
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


from ape_safe import ApeSafe
safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)

# --------------------------------
# May 17, 2023 - OETH AMO Deposit 2
# --------------------------------


from world import *


vvc = load_contract("OETHVaultValueChecker", "0x31fd8618379d8e473ec2b1540b906e8e11d2a99b")
AMO = '0x1827F9eA98E0bf96550b2FC20F7233277FcD7E63'


txs = []
with TemporaryFork():
  # Before
  txs.append(vault_oeth_core.rebase({'from':STRATEGIST}))
  txs.append(vvc.takeSnapshot({'from':STRATEGIST}))

  # Strategist
  txs.append(vault_oeth_admin.depositToStrategy(AMO, [weth], [570*1e18], {'from': STRATEGIST}))

  #After
  vault_change = vault_oeth_core.totalValue() - vvc.snapshots(STRATEGIST)[0]
  supply_change = oeth.totalSupply() - vvc.snapshots(STRATEGIST)[1]
  profit = vault_change - supply_change
  txs.append(vvc.checkDelta(profit, (0.1 * 10**18), vault_change, (1 * 10**18), {'from': STRATEGIST}))
  print("-----")
  print("Profit", "{:.6f}".format(profit / 10**18), profit)
  print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
  print("-----")
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


from ape_safe import ApeSafe
safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# May 18, 2023 - OETH Timlock change
# --------------------------------

from world import *
txs = []
txs.append(governor.execute(49, {'from': GOV_MULTISIG}))

from ape_safe import ApeSafe
safe = ApeSafe('0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)

# --------------------------------
# May 18, 2023 - OUSD vote for harvest unstick
# --------------------------------

from world import *
txs = []
txs.append(governor_five.castVote(26783105168642592474007511733360276114258114993021495026000012638512598264582, 1, {'from': GOVERNOR_FIVE}))

from ape_safe import ApeSafe
safe = ApeSafe('0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# May 19, 2023 - Weekly OUSD allocation
# 

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
Morpho Aave USDT  66.61%
Morpho Aave DAI 8.06%
Morpho Aave USDC  7.97%
Convex DAI+USDC+USDT  7.71%
Aave DAI  7.4%
Convex OUSD+3Crv  1.84%
Convex LUSD+3Crv  0.39%
Existing Allocation 0%
Aave USDC 0%
Aave USDT 0%
Compound DAI  0%
Compound USDC 0%
Compound USDT 0%
Morpho Compound DAI 0%
Morpho Compound USDC  0%
Morpho Compound USDT  0%
"""


with TemporaryForkWithVaultStats(votes):
    before_votes = with_target_allocations(load_from_blockchain(), votes)

    txs = []
    txs.extend(auto_take_snapshot())

    # From
    txs.append(from_strat(MORPHO_AAVE_STRAT, [[2_280_000, dai], [3_855_000, usdc]]))
    txs.append(from_strat(OUSD_METASTRAT, [[4_420_000, usdt]]))
    txs.append(from_strat(LUSD_3POOL_STRAT, [[240_000, usdt]]))

    # Swap
    txs.append(to_strat(CONVEX_STRAT, [[310_000, dai], [3_855_000, usdc]]))
    txs.append(from_strat(CONVEX_STRAT, [[2_445_000, usdt]]))

    # To
    txs.append(to_strat(AAVE_STRAT, [[1_970_000, dai]]))
    txs.append(to_strat(MORPHO_AAVE_STRAT, [[7_138_000, usdt]]))

    # # Defaults
    #txs.append(vault_admin.setAssetDefaultStrategy(dai, MORPHO_AAVE_STRAT,{'from':STRATEGIST}))

    txs.extend(auto_check_snapshot())
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# May 19, 2023 - OETH AMO Deposit
# --------------------------------

from world import *

vvc = load_contract("OETHVaultValueChecker", "0x31fd8618379d8e473ec2b1540b906e8e11d2a99b")
AMO = '0x1827F9eA98E0bf96550b2FC20F7233277FcD7E63'


txs = []
with TemporaryFork():
  # Before
  txs.append(vault_oeth_core.rebase({'from':STRATEGIST}))
  txs.append(vvc.takeSnapshot({'from':STRATEGIST}))

  # Strategist
  txs.append(vault_oeth_admin.depositToStrategy(AMO, [weth], [350*1e18], {'from': STRATEGIST}))

  #After
  vault_change = vault_oeth_core.totalValue() - vvc.snapshots(STRATEGIST)[0]
  supply_change = oeth.totalSupply() - vvc.snapshots(STRATEGIST)[1]
  profit = vault_change - supply_change
  txs.append(vvc.checkDelta(profit, (0.1 * 10**18), vault_change, (10 * 10**18), {'from': STRATEGIST}))
  print("-----")
  print("Profit", "{:.6f}".format(profit / 10**18), profit)
  print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
  print("-----")
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


from ape_safe import ApeSafe
safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# May 22, 2023 - AMO Balance OUSD - DRAFT
# 

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
Morpho Aave USDT  66.61%
Morpho Aave DAI 8.06%
Morpho Aave USDC  7.97%
Convex DAI+USDC+USDT  7.71%
Aave DAI  7.4%
Convex OUSD+3Crv  1.84%
Convex LUSD+3Crv  0.39%
Existing Allocation 0%
Aave USDC 0%
Aave USDT 0%
Compound DAI  0%
Compound USDC 0%
Compound USDT 0%
Morpho Compound DAI 0%
Morpho Compound USDC  0%
Morpho Compound USDT  0%
"""


with TemporaryForkWithVaultStats(votes):
    before_votes = with_target_allocations(load_from_blockchain(), votes)
    print(c18(ousd_metapool.balances(0)))
    print(c18(ousd_metapool.balances(1)))

    txs = []
    txs.extend(auto_take_snapshot())

    # Moves
    txs.append(from_strat(MORPHO_AAVE_STRAT, [[2_000_000, dai],[2_000_000, usdc],[4_000_000, usdt]]))
    txs.append(to_strat(OUSD_METASTRAT, [[2_000_000, dai],[2_000_000, usdc],[4_000_000, usdt]]))
    txs.append(vault_admin.withdrawAllFromStrategy(OUSD_METASTRAT, {'from': STRATEGIST}))
    txs.append(to_strat(OUSD_METASTRAT, [[600_000, dai],[600_000, usdc],[800_000, usdt]]))
    txs.append(vault_core.allocate({'from': STRATEGIST}))
    

    txs.extend(auto_check_snapshot())

    print(c18(ousd_metapool.balances(0)))
    print(c18(ousd_metapool.balances(1)))
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)




# --------------------------------
# May 31, 2023 - OETH Morpho Aave deposit
# --------------------------------

from world import *

txs = []
with TemporaryFork():
  # Before
  txs.append(vault_oeth_core.rebase({'from':STRATEGIST}))
  txs.append(oeth_vault_value_checker.takeSnapshot({'from':STRATEGIST}))

  # Strategist
  txs.append(vault_oeth_admin.depositToStrategy(OETH_MORPHO_AAVE_STRAT, [weth], [57.2*10**18], {'from': STRATEGIST}))

  #After
  vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
  supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
  profit = vault_change - supply_change
  txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (0.1 * 10**18), {'from': STRATEGIST}))

  morpho_balance = oeth_morpho_aave_strat.checkBalance(WETH)
  print("-----")
  print("Profit", "{:.6f}".format(profit / 10**18), profit)
  print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
  print("Morpho Aave Balance", "{:.6f}".format(morpho_balance / 10**18))
  print("-----")
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))

print("Schedule the following transactions on Gnosis Safe")
for idx, item in enumerate(txs):
  print("Transaction ", idx)
  print("To: ", item.receiver)
  print("Data (Hex encoded): ", item.input, "\n")


# --------------------------------
# May 31, 2023 - OETH Morpho Aave deposit - test that withdrawal works
# --------------------------------
txs = []
with TemporaryFork():
  # Before
  txs.append(vault_oeth_core.rebase({'from':STRATEGIST}))
  txs.append(oeth_vault_value_checker.takeSnapshot({'from':STRATEGIST}))

  # Strategist
  txs.append(vault_oeth_admin.withdrawAllFromStrategy(OETH_MORPHO_AAVE_STRAT, {'from': STRATEGIST}))

  #After
  vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
  supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
  profit = vault_change - supply_change
  txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (0.1 * 10**18), {'from': STRATEGIST}))

  morpho_balance = oeth_morpho_aave_strat.checkBalance(WETH)
  print("-----")
  print("Profit", "{:.6f}".format(profit / 10**18), profit)
  print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
  print("Morpho Aave Balance", "{:.6f}".format(morpho_balance / 10**18))
  print("-----")

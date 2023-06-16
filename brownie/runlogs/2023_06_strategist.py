# --------------------------------
# June 1, 2023 - OETH AMO Deposit
# --------------------------------

from world import *

txs = []
with TemporaryFork():
  # Before
  txs.append(vault_oeth_core.rebase({'from':STRATEGIST}))
  txs.append(oeth_vault_value_checker.takeSnapshot({'from':STRATEGIST}))

  # Strategist
  txs.append(vault_oeth_admin.depositToStrategy(OETH_CONVEX_OETH_ETH_STRAT, [weth], [660*1e18], {'from': STRATEGIST}))

  #After
  vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
  supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
  profit = vault_change - supply_change
  txs.append(oeth_vault_value_checker.checkDelta(profit, (0.1 * 10**18), vault_change, (10 * 10**18), {'from': STRATEGIST}))
  print("-----")
  print("Profit", "{:.6f}".format(profit / 10**18), profit)
  print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)
  print("-----")
  print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))

  print("Schedule the following transactions on Gnosis Safe")
  for idx, item in enumerate(txs):
    print("Transaction ", idx)
    print("To: ", item.receiver)
    print("Data (Hex encoded): ", item.input, "\n")


# --------------------------------
# June 2, 2023 - OETH Morpho Aave withdrawAll
# --------------------------------

from world import *

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
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))

print("Schedule the following transactions on Gnosis Safe")
for idx, item in enumerate(txs):
  print("Transaction ", idx)
  print("To: ", item.receiver)
  print("Data (Hex encoded): ", item.input, "\n")

# --------------------------------
# June 2, 2023 - OUSD Aave Withdraw all
# --------------------------------

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

with TemporaryForkWithVaultStats(votes):
    txs = []
    txs.extend(auto_take_snapshot())

    txs.append(world.vault_admin.withdrawAllFromStrategy(MORPHO_AAVE_STRAT, {"from": world.STRATEGIST}))

    txs.extend(auto_check_snapshot())
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))

print("Schedule the following transactions on Gnosis Safe")
for idx, item in enumerate(txs):
  print("Transaction ", idx)
  print("To: ", item.receiver)
  print("Data (Hex encoded): ", item.input, "\n")


# --------------------------------
# June 6, 2023 - OUSD Deposit to Aave
# --------------------------------

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
    txs = []
    txs.extend(auto_take_snapshot())
    txs.append(to_strat(AAVE_STRAT, [[2_250_000, dai],[2_000_000, usdc],[14_740_000, usdt]]))

    txs.append(vault_admin.setVaultBuffer(0, {'from':STRATEGIST}))

    # Defaults
    txs.append(vault_admin.setAssetDefaultStrategy(dai, AAVE_STRAT,{'from':STRATEGIST}))
    txs.append(vault_admin.setAssetDefaultStrategy(usdc, AAVE_STRAT,{'from':STRATEGIST}))
    txs.append(vault_admin.setAssetDefaultStrategy(usdt, AAVE_STRAT,{'from':STRATEGIST}))

    txs.extend(auto_check_snapshot())
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))

print("Schedule the following transactions on Gnosis Safe")
for idx, item in enumerate(txs):
  print("Transaction ", idx)
  print("To: ", item.receiver)
  print("Data (Hex encoded): ", item.input, "\n")


# --------------------------------
# June 9th, 2023 - Allocation
# --------------------------------

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
Morpho Aave USDT  40.23%
Morpho Aave DAI 0%
Morpho Aave USDC  0%
Convex DAI+USDC+USDT  0.56%
Convex OUSD+3Crv  7.05%
Convex LUSD+3Crv  0.02%
Existing Allocation 0%
Aave DAI  1.16%
Aave USDC 7.25%
Aave USDT 4.02%
Compound DAI  0%
Compound USDC 0%
Compound USDT 0%
Morpho Compound DAI 0%
Morpho Compound USDC  0%
Morpho Compound USDT  39.71%
"""

with TemporaryForkWithVaultStats(votes):
    txs = []
    txs.extend(auto_take_snapshot())

    # From
    txs.append(from_strat(AAVE_STRAT, [[3_996_000, dai], [288_000, usdc], [13_960_000, usdt]]))
    txs.append(from_strat(LUSD_3POOL_STRAT, [[100_000, usdt]]))

    # Swap
    txs.append(to_strat(CONVEX_STRAT, [[3_995_000, dai]]))
    # = 3_995_000 + 1_925_000 = 5_920_000
    txs.append(from_strat(CONVEX_STRAT, [[5_920_000, usdt]]))

    # To
    txs.append(to_strat(MORPHO_AAVE_STRAT, [[9_955_000, usdt]]))
    txs.append(to_strat(OUSD_METASTRAT, [[288_000, usdc], [200_000, usdt]]))
    txs.append(to_strat(MORPHO_COMP_STRAT, [[9_827_000, usdt]]))

    # Defaults
    txs.append(vault_admin.setAssetDefaultStrategy(usdt, MORPHO_AAVE_STRAT,{'from':STRATEGIST}))

    txs.extend(auto_check_snapshot())
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))

print("Schedule the following transactions on Gnosis Safe")
for idx, item in enumerate(txs):
  print("Transaction ", idx)
  print("To: ", item.receiver)
  print("Data (Hex encoded): ", item.input, "\n")



# --------------------------------
# June 15th, 2023 - OUSD handle USDC de-peg
# --------------------------------

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
Morpho Aave USDT  40.23%
Morpho Aave DAI 0%
Morpho Aave USDC  0%
Convex DAI+USDC+USDT  0.56%
Convex OUSD+3Crv  7.05%
Convex LUSD+3Crv  0.02%
Existing Allocation 0%
Aave DAI  1.16%
Aave USDC 7.25%
Aave USDT 4.02%
Compound DAI  0%
Compound USDC 0%
Compound USDT 0%
Morpho Compound DAI 0%
Morpho Compound USDC  0%
Morpho Compound USDT  39.71%
"""

with TemporaryForkWithVaultStats(votes):
    txs = []
    txs.extend(auto_take_snapshot())

    # Withdraw funds
    txs.append(vault_admin.withdrawAllFromStrategies({'from': STRATEGIST}))

    txs.append(flipper.withdrawAll({'from': STRATEGIST}))
  
    txs.extend(auto_check_snapshot())
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))

print("Schedule the following transactions on Gnosis Safe")
for idx, item in enumerate(txs):
  print("Transaction ", idx)
  print("To: ", item.receiver)
  print("Data (Hex encoded): ", item.input, "\n")


# --------------------------------
# June 15th, 2023 - OUSD handle USDC de-peg. Allocation buffer to 100%
# --------------------------------

from addresses import *
from world import *
from allocations import *
from ape_safe import ApeSafe

votes = """
Morpho Aave USDT  40.23%
Morpho Aave DAI 0%
Morpho Aave USDC  0%
Convex DAI+USDC+USDT  0.56%
Convex OUSD+3Crv  7.05%
Convex LUSD+3Crv  0.02%
Existing Allocation 0%
Aave DAI  1.16%
Aave USDC 7.25%
Aave USDT 4.02%
Compound DAI  0%
Compound USDC 0%
Compound USDT 0%
Morpho Compound DAI 0%
Morpho Compound USDC  0%
Morpho Compound USDT  39.71%
"""

with TemporaryForkWithVaultStats(votes):
    txs = []
    # Withdraw funds
    txs.append(vault_admin.setVaultBuffer(10**18, {'from': STRATEGIST}))
    
print("Est Gas Max: {:,}".format(1.10*sum([x.gas_used for x in txs])))

print("Schedule the following transactions on Gnosis Safe")
for idx, item in enumerate(txs):
  print("Transaction ", idx)
  print("To: ", item.receiver)
  print("Data (Hex encoded): ", item.input, "\n")
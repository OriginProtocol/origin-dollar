# --------------------------------
# Jan 3, 2022
# 
# Amounts are small enough we can run in a single day.
#
# 1. Move 2.0 million DAI from AAVE.
# 2. Move 5.5 million DAI and 4.5 million USDC from Compound

# 2.0 + (5.5 + 4.5) = 12



# 1. Move 2.0 million DAI from AAVE.
# Targeting 317 loss. 500  max loss.

from world import *
from ape_safe import ApeSafe
safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
show_vault_holdings()

strategist.transfer(to='0x5B98B3255522E95f842967723Ee4Cc7dCEaa9150', data='0xb3d3d37e')
strategist.transfer(to=vault_core, data='0x7fe2d3930000000000000000000000005e3646a1db86993f73e6b74a57d8640b69f7e259000000000000000000000000ea2ef2e2e5a749d4a66b41db9ad85a38aa264cb3000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000010000000000000000000000006b175474e89094c44da98b954eedeac495271d0f000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000001a784379d99db42000000')
strategist.transfer(to='0x5B98B3255522E95f842967723Ee4Cc7dCEaa9150', data='0x2cd47c2300000000000000000000000000000000000000000000001b1ae4d6e2ef500000')
show_vault_holdings()

safe_tx = safe.multisend_from_receipts([history[-3], history[-2], history[-1]], safe_nonce=64)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)



# 2. Move 5.5 million DAI and 4.5 million USDC from Compound
# Targeting 628 loss. 900 max loss

from world import *
from ape_safe import ApeSafe
safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
show_vault_holdings()

strategist.transfer(to='0x5B98B3255522E95f842967723Ee4Cc7dCEaa9150', data='0xb3d3d37e')
strategist.transfer(to=vault_core, data='0x7fe2d3930000000000000000000000009c459eeb3fa179a40329b81c1635525e9a0ef094000000000000000000000000ea2ef2e2e5a749d4a66b41db9ad85a38aa264cb3000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000006b175474e89094c44da98b954eedeac495271d0f000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000048cab98f1671af580000000000000000000000000000000000000000000000000000000000417bce6c800')
strategist.transfer(to='0x5B98B3255522E95f842967723Ee4Cc7dCEaa9150', data='0x2cd47c23000000000000000000000000000000000000000000000030ca024f987b900000')
show_vault_holdings()

safe_tx = safe.multisend_from_receipts([history[-3], history[-2], history[-1]], safe_nonce=65)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)



# --------------------------------
# Jan 6, 2022
# 
# More complicated, since we are moving funds into and out of convex
# I think we'll roll it all into one multisend
#
# 1. Move 7.9 million USDT, 3.5 million DAI from Convex to Compound
# 2. Move 26.9 Million USDC from Compound to Convex
# 3. Move 5.8 million DAI from Compound to AAVE 

from world import *
from ape_safe import ApeSafe
safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')

strategist.transfer(to='0x5B98B3255522E95f842967723Ee4Cc7dCEaa9150', data='0xb3d3d37e')
show_vault_holdings()

strategist.transfer(to=vault_core, data='0x7fe2d393000000000000000000000000ea2ef2e2e5a749d4a66b41db9ad85a38aa264cb30000000000000000000000009c459eeb3fa179a40329b81c1635525e9a0ef094000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000006b175474e89094c44da98b954eedeac495271d0f000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000002e5276153cd3fb38000000000000000000000000000000000000000000000000000000000072f5cb19800')
strategist.transfer(to=vault_core, data='0x7fe2d3930000000000000000000000009c459eeb3fa179a40329b81c1635525e9a0ef094000000000000000000000000ea2ef2e2e5a749d4a66b41db9ad85a38aa264cb3000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4800000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000187724f1c800')
strategist.transfer(to=vault_core, data='0x7fe2d3930000000000000000000000009c459eeb3fa179a40329b81c1635525e9a0ef0940000000000000000000000005e3646a1db86993f73e6b74a57d8640b69f7e259000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000010000000000000000000000006b175474e89094c44da98b954eedeac495271d0f000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000004cc32a1490afbd9000000')
show_vault_holdings()

strategist.transfer(to='0x5B98B3255522E95f842967723Ee4Cc7dCEaa9150', data='0x2cd47c230000000000000000000000000000000000000000000001c75d6ae6e481400000')


safe_tx = safe.multisend_from_receipts([history[-5], history[-4],history[-3], history[-2], history[-1]], safe_nonce=72)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# Jan 11, 2022
# Manual Convex Sale

# 1. Harvest Convex
# 2. Extract from vault
# 3. Send to Josh

from world import *
ORIGINTEAM = '0x449e0b5564e0d141b3bc3829e74ffa0ea8c08ad5'
cvx = Contract.from_abi("cvx", '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B', ousd.abi)

#1. Harvest
print('Before, vault CVX: ' + c18(cvx.balanceOf(vault_core)))
vault_admin.harvestAndSwap(CONVEX_STRAT, {'from': GOVERNOR})


#2. transferToken to gov
cvx_balance = cvx.balanceOf(vault_core)
print('After Harvest, vault CVX: ' + c18(cvx_balance))
vault_admin.transferToken(cvx, cvx_balance, {'from': GOVERNOR})

#3. transfer to team
cvx.transfer(ORIGINTEAM, cvx_balance, {'from': GOVERNOR})
print('After, team CVX: '+c18(cvx.balanceOf(ORIGINTEAM)))

txs = [history[-3], history[-2], history[-1]]

gov = Contract.from_explorer(GOVERNOR)
gov.propose(
	[x.receiver for x in txs],
	["harvestAndSwap(address)","transferToken(address,uint256)","transfer(address,uint256)"],
	['0x'+x.input[10:] for x in txs],
	"Manual CVX sale", {'from': STRATEGIST}
)
print("Use these parameters to propose from metamask")
print("TO: "+history[-1].receiver)
print("DATA: "+history[-1].input)


# uncomment to test, 
# will fail because these txs have already executed, but you can see them trying.
# gov.queue(21, {'from': '0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899'})
# chain.sleep(48*60*60+1)
# gov.execute(21, {'from': '0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899'})


# ----------------

from world import *
from ape_safe import ApeSafe
safe = ApeSafe(GOV_MULTISIG)
gov = Contract.from_explorer(GOVERNOR)
ORIGINTEAM = '0x449e0b5564e0d141b3bc3829e74ffa0ea8c08ad5'

gov.queue(21, {'from': GOV_MULTISIG})

chain.sleep(48*60*60+1)
gov.execute(21, {'from': GOV_MULTISIG})

cvx = Contract.from_abi("cvx", '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B', ousd.abi)
print('After, team CVX: '+c18(cvx.balanceOf(ORIGINTEAM)))

# safe_tx = safe.multisend_from_receipts([history[-2]], safe_nonce=57)
# safe.sign_with_frame(safe_tx)
# r = safe.post_transaction(safe_tx)

# --------------------------------
# Jan 13, 2022
# Propose redeem fee reduction

from world import *
print(vault_admin.redeemFeeBps())
tx = vault_admin.setRedeemFeeBps(25, {'from': GOVERNOR})
tx.sig_string = 'setRedeemFeeBps(uint256)'
print(vault_admin.redeemFeeBps())

create_gov_proposal("Reduce redeem fee", [tx])
sim_governor_execute(22)


# --------------------------------
# Jan 14, 2022
# Big Strat moves

from world import *

show_vault_holdings()


# 1. Snapshot our balances
tx1 = gova.transfer(to='0x5B98B3255522E95f842967723Ee4Cc7dCEaa9150', data='0xb3d3d37e')
tx1.sig_string = 'takeSnapshot()'

# 2. Allow AAVE strategy to hold USDT
tx2 = aave_strat.setPTokenAddress(USDT, '0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811', {'from': GOVERNOR})
tx2.sig_string = 'setPTokenAddress(address,address)'

# 3. Change USDT's default to AAVE
tx3 = vault_admin.setAssetDefaultStrategy(USDT, AAVE_STRAT, {'from': GOVERNOR})
tx3.sig_string = 'setAssetDefaultStrategy(address,address)'

# 4. Change DAI's default to Compount
tx4 =vault_admin.setAssetDefaultStrategy(DAI, COMP_STRAT, {'from': GOVERNOR})
tx4.sig_string = 'setAssetDefaultStrategy(address,address)'

# 5&6. Withdraw all from both stragegies, thus ensuring clean zero balances the unused strats
tx5 = vault_admin.withdrawAllFromStrategy(AAVE_STRAT, {'from': GOVERNOR})
tx5.sig_string = 'withdrawAllFromStrategy(address)'
tx6 = vault_admin.withdrawAllFromStrategy(COMP_STRAT, {'from': GOVERNOR})
tx6.sig_string = 'withdrawAllFromStrategy(address)'

# 7. Allocate all funds to the default strategies. Thus putting all the funds back to work.
tx7 = vault_core.allocate({'from':GOVERNOR})
tx7.sig_string = 'allocate()'

# 8 Check that we have lost no money in any of this. (We should have gained a little from harvesting COMP)
tx8 = strategist.transfer(to='0x5B98B3255522E95f842967723Ee4Cc7dCEaa9150', data='0x2cd47c230000000000000000000000000000000000000000000000000000000000000000')
tx8.sig_string = 'checkLoss(int256)'

show_vault_holdings()
c6(aave_strat.checkBalance(USDT))

create_gov_proposal("Strategist allocation", [tx1, tx2, tx3, tx4, tx5, tx6, tx7, tx8])
sim_governor_execute(23)



# --------------------------------
# Jan 18, 2022
# Manual Convex Sale

# 1. Harvest Convex
# 2. Extract from vault
# 3. Send to Josh

from world import *
ORIGINTEAM = '0x449e0b5564e0d141b3bc3829e74ffa0ea8c08ad5'
cvx = Contract.from_abi("cvx", '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B', ousd.abi)

#1. Harvest
print('Before, vault CVX: ' + c18(cvx.balanceOf(vault_core)))
vault_admin.harvest(CONVEX_STRAT, {'from': GOVERNOR})


#2. transferToken to gov
cvx_balance = cvx.balanceOf(vault_core)
print('After Harvest, vault CVX: ' + c18(cvx_balance))
vault_admin.transferToken(cvx, cvx_balance, {'from': GOVERNOR})

#3. transfer to team
cvx.transfer(ORIGINTEAM, cvx_balance, {'from': GOVERNOR})
print('After, team CVX: '+c18(cvx.balanceOf(ORIGINTEAM)))

txs = [history[-3], history[-2], history[-1]]

gov = Contract.from_explorer(GOVERNOR)
gov.propose(
	[x.receiver for x in txs],
	["harvest(address)","transferToken(address,uint256)","transfer(address,uint256)"],
	['0x'+x.input[10:] for x in txs],
	"Manual CVX sale", {'from': STRATEGIST}
)
print("Use these parameters to propose from metamask")
print("TO: "+history[-1].receiver)
print("DATA: "+history[-1].input)


# --------------------------------
# Jan 21, 2022
# Strat moves


# 1. Move AAVE to Compound, 3.3 million USDT
# 2. Move Convex to Compound, 6.2 million USDT
# 3. Move Convex to AAVE, 4.7 million DAI
# 4. Switch default USDT strat to Compound


from world import *
from ape_safe import ApeSafe
safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')

strategist.transfer(to='0x5B98B3255522E95f842967723Ee4Cc7dCEaa9150', data='0xb3d3d37e')
show_vault_holdings()

strategist.transfer(to=vault_core, data='0x7fe2d3930000000000000000000000005e3646a1db86993f73e6b74a57d8640b69f7e2590000000000000000000000009c459eeb3fa179a40329b81c1635525e9a0ef094000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000003005753e800')
strategist.transfer(to=vault_core, data='0x7fe2d393000000000000000000000000ea2ef2e2e5a749d4a66b41db9ad85a38aa264cb30000000000000000000000009c459eeb3fa179a40329b81c1635525e9a0ef094000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000005a38ccc3000')
strategist.transfer(to=vault_core, data='0x7fe2d393000000000000000000000000ea2ef2e2e5a749d4a66b41db9ad85a38aa264cb30000000000000000000000005e3646a1db86993f73e6b74a57d8640b69f7e259000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000010000000000000000000000006b175474e89094c44da98b954eedeac495271d0f000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000003e34382b25cc341800000')
vault_admin.setAssetDefaultStrategy(USDT, COMP_STRAT, {'from': GOVERNOR})
show_vault_holdings()

strategist.transfer(to='0x5B98B3255522E95f842967723Ee4Cc7dCEaa9150', data='0x2cd47c230000000000000000000000000000000000000000000000a2a15d09519be00000')

print("history len: %d" % len(history))
safe_tx = safe.multisend_from_receipts(history, safe_nonce=74)
# safe.sign_with_frame(safe_tx)
# safe.post_transaction(safe_tx)


# --------------------------------
# Jan 24, 2022
# OGN to timelock

from world import *
ogn = Contract.from_explorer(OGN)
print(ogn.owner() == GOV_MULTISIG)
ogn.transferOwnership(GOVERNOR, {'from': GOV_MULTISIG})

# Local test that GOVERNOR timelock nows owns it
print(c18(ogn.balanceOf(OUSD)))
tx = ogn.mint(OUSD, 1e18, {'from': GOVERNOR})
tx.sig_string = "mint(address,uint256)"
print(c18(ogn.balanceOf(OUSD)))
create_gov_proposal("test ownership", [tx])
sim_governor_execute(25)
print(c18(ogn.balanceOf(OUSD)))


# --------------------------------
# Jan 24, 2022
# Manual Convex Sale

# 1. Harvest Convex
# 2. Extract from vault
# 3. Send to OriginTeam

from world import *
ORIGINTEAM = '0x449e0b5564e0d141b3bc3829e74ffa0ea8c08ad5'
cvx = Contract.from_abi("cvx", '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B', ousd.abi)

#1. Harvest
print('Before, vault CVX: ' + c18(cvx.balanceOf(vault_core)))
vault_admin.harvest(CONVEX_STRAT, {'from': GOVERNOR})


#2. transferToken to gov
cvx_balance = cvx.balanceOf(vault_core)
print('After Harvest, vault CVX: ' + c18(cvx_balance))
vault_admin.transferToken(cvx, cvx_balance, {'from': GOVERNOR})

#3. transfer to team
cvx.transfer(ORIGINTEAM, cvx_balance, {'from': GOVERNOR})
print('After, team CVX: '+c18(cvx.balanceOf(ORIGINTEAM)))

txs = [history[-3], history[-2], history[-1]]

gov = Contract.from_explorer(GOVERNOR)
gov.propose(
	[x.receiver for x in txs],
	["harvest(address)","transferToken(address,uint256)","transfer(address,uint256)"],
	['0x'+x.input[10:] for x in txs],
	"Manual CVX sale", {'from': STRATEGIST}
)
print("Use these parameters to propose from metamask")
print("TO: "+history[-1].receiver)
print("DATA: "+history[-1].input)


# --------------------------------
# Jan 28, 2022 Strategist moves
# 

from allocations import *
from ape_safe import ApeSafe
safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')

txs = transactions_for_reallocation([
        ["AAVE", "DAI", 0.05],
        ["AAVE", "USDC", 0],
        ["AAVE", "USDT", 3.38],
        ["COMP", "DAI", 4.14],
        ["COMP", "USDC", 5.62],
        ["COMP", "USDT", 0],
        ["Convex", "*", 86.81],
    ])
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)

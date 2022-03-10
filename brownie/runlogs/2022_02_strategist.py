# --------------------------------
# Feb ?, 2022
# Manual Convex Sale

# 1. Harvest Convex
# 2. Extract from vault
# 3. Send to Origin Team for sale

from world import *
cvx = Contract.from_abi("cvx", CVX, ousd.abi)

with TemporaryFork():
    #1. Harvest
    print('Before, vault CVX: ' + c18(cvx.balanceOf(vault_core)))
    harvest_tx = vault_admin.harvest(CONVEX_STRAT, {'from': GOVERNOR})
    harvest_tx.sig_string = "harvest(address)"


    #2. transferToken to gov
    cvx_balance = cvx.balanceOf(vault_core)
    print('After Harvest, vault CVX: ' + c18(cvx_balance))
    to_gov_tx = vault_admin.transferToken(cvx, cvx_balance, {'from': GOVERNOR})
    to_gov_tx.sig_string = "transferToken(address,uint256)"

    #3. transfer to team
    to_team_tx = cvx.transfer(ORIGINTEAM, cvx_balance, {'from': GOVERNOR})
    to_team_tx.sig_string = "transfer(address,uint256)"
    print('After, team CVX: '+c18(cvx.balanceOf(ORIGINTEAM)))

create_gov_proposal("Manual CVX sale", [harvest_tx, to_gov_tx, to_team_tx])

# Test
sim_governor_execute(26)



# --------------------------------
# Feb 10, 2022 Strategist moves
# 

from allocations import *
from ape_safe import ApeSafe
safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')

txs = transactions_for_reallocation([
        ["AAVE", "DAI", 0.00],
        ["AAVE", "USDC", 0],
        ["AAVE", "USDT", 1.46],
        ["COMP", "DAI", 1.67],
        ["COMP", "USDC", 3.91],
        ["COMP", "USDT", 0],
        ["Convex", "*", 92.96],
    ])
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# Feb 14, 2022 Strategist refill
# 

from allocations import *
from ape_safe import ApeSafe
safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')

txs = transactions_for_reallocation([
        ["AAVE", "DAI", 0.00],
        ["AAVE", "USDC", 0],
        ["AAVE", "USDT", 1.46],
        ["COMP", "DAI", 1.67],
        ["COMP", "USDC", 3.91],
        ["COMP", "USDT", 0],
        ["Convex", "*", 92.96],
    ])
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# Feb 16, 2022 Strategist refill
# 

from allocations import *
from ape_safe import ApeSafe
safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')

extra_withdraw_pct = 0.86

txs = transactions_for_reallocation([
        ["AAVE", "DAI", 0.00],
        ["AAVE", "USDC", 0],
        ["AAVE", "USDT", 1.46+extra_withdraw_pct/3],
        ["COMP", "DAI", 1.67+extra_withdraw_pct/3],
        ["COMP", "USDC", 3.91+extra_withdraw_pct/3],
        ["COMP", "USDT", 0],
        ["Convex", "*", 92.96-extra_withdraw_pct],
    ])
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# Feb 18, 2022 Strategist allocation
# 

from allocations import *
from ape_safe import ApeSafe

txs = transactions_for_reallocation([
        ["AAVE", "DAI",  0.00],
        ["AAVE", "USDC", 0],
        ["AAVE", "USDT", 2.65],
        ["COMP", "DAI",  2.80],
        ["COMP", "USDC", 4.01],
        ["COMP", "USDT", 0],
        ["Convex", "*",  90.54],
    ])

safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)




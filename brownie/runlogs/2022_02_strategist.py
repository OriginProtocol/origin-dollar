# --------------------------------
# Feb 18, 2022
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
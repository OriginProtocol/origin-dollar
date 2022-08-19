
# --------------------------------
# May 18, Strategy activate / deactivate
# 

from world import *

with TemporaryFork():
        tx = vault_admin.approveStrategy(CONVEX_STRAT, {'from': GOVERNOR})
        tx.sig_string = "approveStrategy(address)"
create_gov_proposal("Add Convex", [tx])

# Test
sim_governor_execute(32)
# Test - should work
vault_admin.reallocate(AAVE_STRAT, CONVEX_STRAT, [USDT], [1e6*1e6], {'from': GOVERNOR})






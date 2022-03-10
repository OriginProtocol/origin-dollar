# --------------------------------
# Mar 4, 2022 Strategist allocation
# 

# from allocations import *
# from ape_safe import ApeSafe
# import time

# txs = transactions_for_reallocation([
#         ["AAVE", "DAI",  26.56],
#         ["AAVE", "USDC", 0.0],
#         ["AAVE", "USDT", 14.4],
#         ["COMP", "DAI",  13.1],
#         ["COMP", "USDC", 10.39+29.62],
#         ["COMP", "USDT", 5.87],
#         ["Convex", "*",  0.0],
#     ])

# safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
# safe_tx = safe.multisend_from_receipts(txs)
# safe.sign_with_frame(safe_tx)
# r = safe.post_transaction(safe_tx)



# --------------------------------
# Mar 8, Strategy activate / deactivate
# 

from world import *

with TemporaryFork():
        remove_comp_tx = vault_admin.removeStrategy(CONVEX_STRAT, {'from': GOVERNOR})
        remove_comp_tx.sig_string = "removeStrategy(address)"
        add_aave_tx = aave_strat.setPTokenAddress(USDC, '0xBcca60bB61934080951369a648Fb03DF4F96263C', {'from': GOVERNOR})
        add_aave_tx.sig_string = "setPTokenAddress(address,address)"

create_gov_proposal("Add AAVE", [remove_comp_tx, add_aave_tx])

# Test
sim_governor_execute(29)
# Test - should work
vault_admin.reallocate(COMP_STRAT, AAVE_STRAT, [USDC], [1e6*1e6], {'from': GOVERNOR})
vault_admin.reallocate(AAVE_STRAT, COMP_STRAT, [USDC], [1e6*1e6], {'from': GOVERNOR})
# Test - should fail
vault_admin.reallocate(COMP_STRAT, CONVEX_STRAT, [USDC], [1e6*1e6], {'from': GOVERNOR})
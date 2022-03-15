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

# --------------------------------
# Feb 21, 2022 Strategist refill
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


# --------------------------------
# Feb 22, 2022 Strategist refill
# 

from allocations import *
from ape_safe import ApeSafe
import time

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

# --------------------------------
# Feb 24, 2022 Withdraw from convex
# 

import allocations
from world import *
from ape_safe import ApeSafe

#  Move funds out of convex
txs = []
with TemporaryFork():
        OPTS = {"from": STRATEGIST}

        before_total = vault_core.totalValue()
        time.sleep(5)

        # 1.  snapshot
        txs.append(vault_value_checker.takeSnapshot(OPTS))
        # 2. withdraw
        txs.append(vault_admin.withdrawAllFromStrategy(CONVEX_STRAT, OPTS))
        time.sleep(5)
        # 3. Allocate
        txs.append(vault_core.allocate(OPTS))
        time.sleep(5)
        # 4. fund AAVE
        txs.append(vault_admin.reallocate(COMP_STRAT, AAVE_STRAT, [dai], [34700000 * 1e18], OPTS ))
        # 5. fund COMP
        txs.append(vault_admin.reallocate(AAVE_STRAT, COMP_STRAT, [usdt], [18400000 * 1e6], OPTS ))
        time.sleep(5)
        
        after_total = vault_core.totalValue()
        vault_loss_raw = before_total - after_total
        vault_loss_dollars = int(vault_loss_raw / 1e18)
        max_loss = int(vault_loss_raw) + int(abs(vault_loss_raw) * 0.1) + 100 * 1e18
        print(
                "Expected loss: ${:,}  Allowed loss from move: ${:,}".format(
                    int(vault_loss_raw // 1e18), int(max_loss // 1e18)
                )
            )

        # 6. snapshot
        txs.append(vault_value_checker.checkLoss(max_loss, OPTS))

        print("After Move")
        after = allocations.load_from_blockchain()
        after['current_allocation'] = after['current_allocation'] * 100
        after = after.rename(
            {
                "current_allocation": "percent",
                "current_dollars": "dollars",
            }
        )
        print(
            after.to_string(
                formatters={
                    "percent": "{:,.2%}".format,
                    "dollars": "{:,}".format,
                }
            )
        )
        print("Expected loss from move: ${:,}".format(vault_loss_dollars))

safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)
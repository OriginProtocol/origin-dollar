# --------------------------------
# Auguest 30, 2022 Strategist allocation
# 

from world import *
from allocations import *
from ape_safe import ApeSafe

with TemporaryFork():
    print(load_from_blockchain())
    txs = [
        vault_value_checker.takeSnapshot({"from": STRATEGIST}),
        vault_admin.setAssetDefaultStrategy(DAI, AAVE_STRAT, {'from': STRATEGIST}),
        vault_admin.setAssetDefaultStrategy(USDC, AAVE_STRAT, {'from': STRATEGIST}),
        vault_admin.setAssetDefaultStrategy(USDT, AAVE_STRAT, {'from': STRATEGIST}),
        vault_admin.withdrawAllFromStrategy(COMP_STRAT, {'from': STRATEGIST}),
        vault_core.allocate({'from': STRATEGIST}),
        vault_value_checker.checkLoss(100 * 1e18, {"from": STRATEGIST}),
    ]
    print(load_from_blockchain())

safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)

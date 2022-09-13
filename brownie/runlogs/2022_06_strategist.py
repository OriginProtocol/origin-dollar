
# --------------------------------
# June 3, 2022 Strategist allocation
# 

from world import *
from allocations import *
from ape_safe import ApeSafe

with TemporaryFork():
    print(load_from_blockchain())
    txs = [
        vault_value_checker.takeSnapshot({"from": STRATEGIST}),
        vault_admin.setAssetDefaultStrategy(DAI, COMP_STRAT, {'from': GOVERNOR}),
        vault_admin.setAssetDefaultStrategy(USDC, COMP_STRAT, {'from': GOVERNOR}),
        vault_admin.setAssetDefaultStrategy(USDT, COMP_STRAT, {'from': GOVERNOR}),
        vault_admin.withdrawAllFromStrategies({'from': GOVERNOR}),
        vault_core.allocate({'from': GOVERNOR}),
        vault_value_checker.checkLoss(0, {"from": STRATEGIST}),
    ]
    print(load_from_blockchain())

safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx

# --------------------------------
# June 8, 2022 Strategist allocation
# 

from world import *
from allocations import *
from ape_safe import ApeSafe

with TemporaryFork():
    print(load_from_blockchain())
    txs = [
        vault_value_checker.takeSnapshot({"from": STRATEGIST}),
        vault_admin.setAssetDefaultStrategy(DAI, COMP_STRAT, {'from': STRATEGIST}),
        vault_admin.setAssetDefaultStrategy(USDC, COMP_STRAT, {'from': STRATEGIST}),
        vault_admin.setAssetDefaultStrategy(USDT, COMP_STRAT, {'from': STRATEGIST}),
        vault_admin.withdrawAllFromStrategy(AAVE_STRAT, {'from': STRATEGIST}),
        vault_core.allocate({'from': STRATEGIST}),
        vault_value_checker.checkLoss(20 * 1e18, {"from": STRATEGIST}),
    ]
    print(load_from_blockchain())

safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# June 20, 2022 Hypothical switch to DAI
# 


from world import *
before = vault_core.totalValue()

show_vault_holdings()

vault_admin.reallocate(COMP_STRAT, CONVEX_STRAT, [usdt], [vault_core.checkBalance(USDT)-700e6], {'from': STRATEGIST})
show_vault_holdings()

vault_admin.reallocate(CONVEX_STRAT, COMP_STRAT, [DAI], [16349052*1e18], {'from': STRATEGIST})
show_vault_holdings()

after = vault_core.totalValue()
c18(before-after)
'          25,810'

# --------------------------------
# June 20, 2022 Hypothical switch to USDC
# 


from world import *
before = vault_core.totalValue()

vault_admin.reallocate(COMP_STRAT, CONVEX_STRAT, [usdt], [vault_core.checkBalance(USDT)-700e6], {'from': STRATEGIST})
vault_admin.reallocate(CONVEX_STRAT, COMP_STRAT, [USDC], [16349052*1e6], {'from': STRATEGIST})

after = vault_core.totalValue()
c18(before-after)
'          15,017'

show_vault_holdings()


# --------------------------------
# June 20, 2022 Hypothical move towards to USDT
# 


from world import *
before = vault_core.totalValue()

vault_admin.reallocate(COMP_STRAT, CONVEX_STRAT, [USDC], [12*1e6*1e6], {'from': STRATEGIST})
vault_admin.reallocate(CONVEX_STRAT, COMP_STRAT, [USDT], [12*1e6*1e6], {'from': STRATEGIST})

after = vault_core.totalValue()
print(c18(before-after))


show_vault_holdings()


# --------------------------------
# June 30, 2022 Move towards to USDT
# 

from world import *
from allocations import *
from ape_safe import ApeSafe

OUSD_3CRVF_POOL = '0x87650D7bbfC3A9F10587d7778206671719d9910D'
ousd_pool = Contract.from_explorer('0x87650D7bbfC3A9F10587d7778206671719d9910D')


txs = []
with TemporaryFork():
    
    EXTRA_AMOUNT = int(27000 * int(1e18))
    SWITCH_AMOUNT = int(vault_core.checkBalance(USDT) // 2)

    before = vault_core.totalValue()
    show_vault_holdings()

    # 1. Prep check loss
    txs.append(vault_value_checker.takeSnapshot({"from": STRATEGIST}));

    # 2. Get some funds to make up for the losses. Use DAI
    txs.append(flipper.withdraw(OUSD, EXTRA_AMOUNT, {'from': STRATEGIST}))
    txs.append(ousd.approve(ousd_pool, EXTRA_AMOUNT, {'from': STRATEGIST}))
    txs.append(ousd_pool.exchange_underlying(0, 1, EXTRA_AMOUNT, int(EXTRA_AMOUNT*0.995), {'from': STRATEGIST}))

    print("OUSD STRATEGIST Balance %s" % c18(ousd.balanceOf(STRATEGIST)))
    print("DAI STRATEGIST Balance %s" % c18(dai.balanceOf(STRATEGIST)))
    print("USDC STRATEGIST Balance %s" % c6(usdc.balanceOf(STRATEGIST)))
    print("USDT STRATEGIST Balance %s" % c6(usdt.balanceOf(STRATEGIST)))

    # 3. Switch half of vault USDT
    txs.append(vault_admin.reallocate(COMP_STRAT, CONVEX_STRAT, [usdt], [SWITCH_AMOUNT], {'from': STRATEGIST}))
    txs.append(vault_admin.reallocate(CONVEX_STRAT, COMP_STRAT, [DAI], [int(SWITCH_AMOUNT*0.9983*1e12)], {'from': STRATEGIST}))

    # 4. Compensate
    needed_dai = (before - vault_core.totalValue()) + (100 * 1e18)
    print("Needed Compensation DAI %s" % c18(needed_dai))
    txs.append(dai.transfer(vault_core, needed_dai, {'from': STRATEGIST}))

    # 5. Verify loss
    txs.append(vault_value_checker.checkLoss(200*1e18, {"from": STRATEGIST}))


    show_vault_holdings()
    after = vault_core.totalValue()
    print(c18(after-before))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)



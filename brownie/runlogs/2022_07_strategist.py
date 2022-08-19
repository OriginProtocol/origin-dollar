# --------------------------------
# July 1, 2022 Finish move to USDT
# 


from world import *
from allocations import *
from ape_safe import ApeSafe

OUSD_3CRVF_POOL = '0x87650D7bbfC3A9F10587d7778206671719d9910D'
ousd_pool = Contract.from_explorer('0x87650D7bbfC3A9F10587d7778206671719d9910D')

txs = []
with TemporaryFork():
    SWITCH_AMOUNT = comp_strat.checkBalance(USDT)
    SWITCH_OUT = int(SWITCH_AMOUNT*0.9987*1e12)
    EXTRA_AMOUNT = 0 # int(7500 * int(1e18))
    
    before = vault_core.totalValue()
    show_vault_holdings()

    # 1. Prep check loss
    txs.append(vault_value_checker.takeSnapshot({"from": STRATEGIST}));

    # 2. Get some funds to make up for the losses. Use DAI
    # if EXTRA_AMOUNT:
    #     txs.append(flipper.withdraw(OUSD, EXTRA_AMOUNT, {'from': STRATEGIST}))
    #     txs.append(ousd.approve(ousd_pool, EXTRA_AMOUNT, {'from': STRATEGIST}))
    #     txs.append(ousd_pool.exchange_underlying(0, 1, EXTRA_AMOUNT, int(EXTRA_AMOUNT*0.998), {'from': STRATEGIST}))

    compensation_dai = dai.balanceOf(STRATEGIST)

    # 3. Compensate
    txs.append(dai.transfer(vault_core, compensation_dai, {'from': STRATEGIST}))

    # 4. Switch vault USDT
    txs.append(vault_admin.reallocate(COMP_STRAT, CONVEX_STRAT, [usdt], [SWITCH_AMOUNT], {'from': STRATEGIST}))
    txs.append(vault_admin.reallocate(CONVEX_STRAT, COMP_STRAT, [DAI], [SWITCH_OUT], {'from': STRATEGIST}))

    print("%s USDT swapped" % c6(SWITCH_AMOUNT))
    print("%s DAI OUT" % c18(SWITCH_OUT))
    trade_change = (vault_core.totalValue() - before) - compensation_dai
    print("%s Trade change" % c18(trade_change))
    print("%s New DAI" % c18(EXTRA_AMOUNT))
    print("%s Total Compensation DAI" % c18(compensation_dai))

    # 5. Verify loss
    expected_loss = ((trade_change * -1)) - compensation_dai
    print("%s Expected loss, after compensation." % c18(expected_loss))    
    max_loss = expected_loss + 600 * int(1e18)
    print("%s Max TX loss" % c18(max_loss))    
    txs.append(vault_value_checker.checkLoss(max_loss, {"from": STRATEGIST}))


    show_vault_holdings()
    after = vault_core.totalValue()
    print(c18(after-before))


safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# July 6, 2022 Finalize staking contract deploy
# 

from world import *
from ape_safe import ApeSafe

ogv = Contract.from_explorer('0x9c354503C38481a7A7a51629142963F98eCC12D0')
rewards = Contract.from_explorer('0x7d82e86cf1496f9485a8ea04012afeb3c7489397')
staking = Contract.from_explorer('0x0c4576ca1c365868e162554af8e385dc3e7c66d9')

txs = []
with TemporaryFork():
    stakingProxy = Contract.from_abi('q', staking.address, rewards.abi)
    txs.append(stakingProxy.claimGovernance({'from': GOV_MULTISIG}))
    txs.append(rewards.claimGovernance({'from': GOV_MULTISIG}))
    txs.append(ogv.grantMinterRole(rewards, {'from': GOV_MULTISIG}))

safe = ApeSafe('0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)
# --------------------------------
# Sept 19, 2022 Strategist allocation
# 

from world import *
from allocations import *
from ape_safe import ApeSafe

with TemporaryFork():
    print_vault_allocations()
    txs = [
        vault_admin.reallocate(
            AAVE_STRAT, COMP_STRAT,
            [USDC, DAI],
            [6_300_000*int(1e6), 9_200_000*int(1e18)],
            {'from': STRATEGIST}
        )
    ]
    print_vault_allocations()

safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# Sept 21, 2022 OGV Buyback
# 

from world import *
from ape_safe import ApeSafe

BUYBACK_AMOUNT = 5000 * int(1e18)
MIN_PERCENT_AFTER_SLIPPAGE = 0.97
REWARDS = "0x7d82E86CF1496f9485a8ea04012afeb3C7489397"
buyback = Contract.from_abi("Buyback", vault_core.trusteeAddress(), buyback.abi)
ogv = Contract.from_explorer("0x9c354503C38481a7A7a51629142963F98eCC12D0")

amount_no_mev = 0

# Nominal price sim
with TemporaryFork():
    before = ogv.balanceOf(REWARDS)
    buyback.swapNow(1e18, 1, {'from': STRATEGIST})
    after = ogv.balanceOf(REWARDS)
    amount_no_mev = after - before

print("Best-case buyback amount %s OUSD for %s OGV" % (
    c18(BUYBACK_AMOUNT),
    c18(amount_no_mev*BUYBACK_AMOUNT/int(1e18))
))
print("Best-case price $%f"%(1e18 / amount_no_mev))


# Expected Swap sim
with TemporaryFork():
    before = ogv.balanceOf(REWARDS)
    buyback.swapNow(BUYBACK_AMOUNT, 1, {'from': STRATEGIST})
    after = ogv.balanceOf(REWARDS)
    amount_no_mev = after - before

print("Target buyback amount %s OUSD for %s OGV"%(c18(BUYBACK_AMOUNT), c18(amount_no_mev)))
print("Target price $%f"%(BUYBACK_AMOUNT / amount_no_mev))
print("Min amount %s OGV"%(c18(int(amount_no_mev*MIN_PERCENT_AFTER_SLIPPAGE))))

# Actual Swap TX
txs = [
    buyback.swapNow(BUYBACK_AMOUNT, int(amount_no_mev*MIN_PERCENT_AFTER_SLIPPAGE), {'from': STRATEGIST})
]

# Send
safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)

# --------------------------------
# Sept 22, 2022 OGV Buyback
# 


from world import *
from ape_safe import ApeSafe

BUYBACK_AMOUNT = ousd.balanceOf(buyback)
MIN_PERCENT_AFTER_SLIPPAGE = 0.97
REWARDS = "0x7d82E86CF1496f9485a8ea04012afeb3C7489397"
buyback = Contract.from_abi("Buyback", vault_core.trusteeAddress(), buyback.abi)
ogv = Contract.from_explorer("0x9c354503C38481a7A7a51629142963F98eCC12D0")



amount_no_mev = 0

# Nominal price sim
with TemporaryFork():
    before = ogv.balanceOf(REWARDS)
    buyback.swapNow(1e18, 1, {'from': STRATEGIST})
    after = ogv.balanceOf(REWARDS)
    amount_no_mev = after - before

print("Best-case buyback amount %s OUSD for %s OGV" % (
    c18(BUYBACK_AMOUNT),
    c18(amount_no_mev*BUYBACK_AMOUNT/int(1e18))
))
print("Best-case price $%f"%(1e18 / amount_no_mev))


# Expected Swap sim
with TemporaryFork():
    before = ogv.balanceOf(REWARDS)
    buyback.swapNow(BUYBACK_AMOUNT, 1, {'from': STRATEGIST})
    after = ogv.balanceOf(REWARDS)
    amount_no_mev = after - before

print("Target buyback amount %s OUSD for %s OGV"%(c18(BUYBACK_AMOUNT), c18(amount_no_mev)))
print("Target price $%f"%(BUYBACK_AMOUNT / amount_no_mev))
print("Min amount %s OGV"%(c18(int(amount_no_mev*MIN_PERCENT_AFTER_SLIPPAGE))))

# Actual Swap TX
txs = [
    buyback.swapNow(BUYBACK_AMOUNT, int(amount_no_mev*MIN_PERCENT_AFTER_SLIPPAGE), {'from': STRATEGIST})
]

# Send
safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)


# --------------------------------
# Sept 22, 2022 OGV Buyback
# 

from world import *

REWARDS = "0x7d82E86CF1496f9485a8ea04012afeb3C7489397"
newgov = Contract.from_explorer("0x3cdD07c16614059e66344a7b579DAB4f9516C0b6")
timelock = Contract.from_explorer(newgov.timelock())
ogv = Contract.from_explorer("0x9c354503C38481a7A7a51629142963F98eCC12D0")

DESC_PASS = """Test passing proposal

Let's pass this vote!

It sends 1 extra OGV to the rewards contract for distribution.

Here's a test link: http://ousd.com
"""

DESC_FAIL = """Test failed proposal
Let's reject this proposal during voting.
"""

DESC_CANCEL = """Test cancel proposal

Let's try canceling this proposal.
"""


DESC_FUN = """By the Power vested in me by Thor

I can spam this board any time I want for $10.
"""


with TemporaryFork():
    inner_tx = ogv.transfer(REWARDS, 1*1e18, {'from': timelock})

with TemporaryFork():
    TEST_SIG  = "transfer(address,uint256)"
    TEST_DATA  = '0000000000000000000000007d82e86cf1496f9485a8ea04012afeb3c74893970000000000000000000000000000000000000000000000000de0b6b3a7640000'
    txs = [
        ogv.transfer(timelock, 1*1e18, {'from': GOV_MULTISIG}),
        newgov.propose([ogv], [0], [TEST_SIG], [TEST_DATA], DESC_PASS, {'from': GOV_MULTISIG}),
        newgov.propose([ogv], [0], [TEST_SIG], [TEST_DATA], DESC_FAIL, {'from': GOV_MULTISIG}),
        newgov.propose([ogv], [0], [TEST_SIG], [TEST_DATA], DESC_CANCEL, {'from': GOV_MULTISIG})
    ]

    

safe = ApeSafe('0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)




# --------------------------------
# Sept 2X?, 2022 Strategist allocation
# 

from world import *
from allocations import *
from ape_safe import ApeSafe

FROM_STRAT = AAVE_STRAT
TO_STRAT = COMP_STRAT

with TemporaryFork():
    print(load_from_blockchain())
    txs = [
        vault_value_checker.takeSnapshot({"from": STRATEGIST}),
        vault_admin.setAssetDefaultStrategy(DAI, TO_STRAT, {'from': STRATEGIST}),
        vault_admin.setAssetDefaultStrategy(USDC, TO_STRAT, {'from': STRATEGIST}),
        vault_admin.setAssetDefaultStrategy(USDT, TO_STRAT, {'from': STRATEGIST}),
        vault_admin.withdrawAllFromStrategy(FROM_STRAT, {'from': STRATEGIST}),
        vault_core.allocate({'from': STRATEGIST}),
        vault_value_checker.checkLoss(100 * 1e18, {"from": STRATEGIST}),
    ]
    print(load_from_blockchain())

safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)



# --------------------------------
# Sept 30, 2022 OGV Buyback
# 


from world import *
from ape_safe import ApeSafe


MIN_PERCENT_AFTER_SLIPPAGE = 0.97
REWARDS = "0x7d82E86CF1496f9485a8ea04012afeb3C7489397"
buyback = Contract.from_abi("Buyback", vault_core.trusteeAddress(), buyback.abi)
ogv = Contract.from_explorer("0x9c354503C38481a7A7a51629142963F98eCC12D0")

BUYBACK_AMOUNT = ousd.balanceOf(buyback)


amount_no_mev = 0

# Nominal price sim
with TemporaryFork():
    before = ogv.balanceOf(REWARDS)
    buyback.swapNow(1e18, 1, {'from': STRATEGIST})
    after = ogv.balanceOf(REWARDS)
    amount_no_mev = after - before

print("Best-case buyback amount %s OUSD for %s OGV" % (
    c18(BUYBACK_AMOUNT),
    c18(amount_no_mev*BUYBACK_AMOUNT/int(1e18))
))
print("Best-case price $%f"%(1e18 / amount_no_mev))


# Expected Swap sim
with TemporaryFork():
    before = ogv.balanceOf(REWARDS)
    buyback.swapNow(BUYBACK_AMOUNT, 1, {'from': STRATEGIST})
    print(history[-1].call_trace(True))
    after = ogv.balanceOf(REWARDS)
    amount_no_mev = after - before

print("Target buyback amount %s OUSD for %s OGV"%(c18(BUYBACK_AMOUNT), c18(amount_no_mev)))
print("Target price $%f"%(BUYBACK_AMOUNT / amount_no_mev))
print("Min amount %s OGV"%(c18(int(amount_no_mev*MIN_PERCENT_AFTER_SLIPPAGE))))

# Actual Swap TX
txs = [
    buyback.swapNow(BUYBACK_AMOUNT, int(amount_no_mev*MIN_PERCENT_AFTER_SLIPPAGE), {'from': STRATEGIST})
]

# Send
safe = ApeSafe('0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC')
safe_tx = safe.multisend_from_receipts(txs)
safe.sign_with_frame(safe_tx)
r = safe.post_transaction(safe_tx)
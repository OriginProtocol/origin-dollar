from world import *

me = ORIGINTEAM
OPTS = {'from': me}

THREEPOOL_BAGS = '0xceaf7747579696a2f0bb206a14210e3c9e6fb269'
OUSD_BAGS = '0x8e02247d3ee0e6153495c971ffd45aa131f4d7cb'
OUSD_BAGS_2 = '0xc055de577ce2039e6d35621e3a885df9bb304ab9'
TOTAL_AMOUNT = int(11e6) * int(1e18)

# threepool_swap = Contract.from_explorer(THREEPOOL_SWAP)

threepool_lp = load_contract('threepool_lp', THREEPOOL_LP)
ousd_metapool = load_contract('ousd_metapool', OUSD_METAPOOL)

# 1. Acquire 3pool
threepool_lp.transfer(me, TOTAL_AMOUNT, {'from': THREEPOOL_BAGS})
ousd.transfer(me, 6*1e6*1e18, {'from': OUSD_BAGS})
ousd.transfer(me, 5*1e6*1e18, {'from': OUSD_BAGS_2})

threepool_lp.approve(ousd_metapool, int(1e50), OPTS)
ousd.approve(ousd_metapool, int(1e50), OPTS)


threepool_virtual_price = 1.0207179561342827 # This should not be hardcoded
ousd_metapool_virtual_price = ousd_metapool.get_virtual_price()

#2. Deposit in metapool

# # Mix of funds


# TOTAL_AMOUNT = int(11e6) * int(1e18)
# out = []
# for mint_ratio in range(0, 21, 1):
#     mint_ratio = mint_ratio / 20.0
#     with TemporaryFork():
#         ousd_amount = TOTAL_AMOUNT * int(mint_ratio * 100) // int(100)
#         threepool_amount = int((TOTAL_AMOUNT - ousd_amount))
#         ousd_metapool.add_liquidity([ousd_amount, int(threepool_amount / threepool_virtual_price)], 0, me, OPTS)
#         out.append([mint_ratio, ousd_metapool.balanceOf(me) * ousd_metapool_virtual_price / TOTAL_AMOUNT, int(threepool_amount), int(ousd_amount)])
#         print(out[-1])


# print("-----")
# for line in out:
#     print(",".join([str(x) for x in line]))


# # 3Pool deposits only
# print("-----")
# out = []
# TOTAL_AMOUNT = int(11e6) * int(1e18)
# for mint_ratio in range(0, 20, 1):
#     mint_ratio = mint_ratio / 20.0
#     with TemporaryFork():
#         ousd_amount = TOTAL_AMOUNT * int(mint_ratio * 100) // int(100)
#         threepool_amount = int((TOTAL_AMOUNT - ousd_amount))
#         ousd_amount = 0
#         ousd_metapool.add_liquidity([ousd_amount, int(threepool_amount / threepool_virtual_price)], 0, me, OPTS)
#         out.append([mint_ratio, ousd_metapool.balanceOf(me) * ousd_metapool_virtual_price / threepool_amount, int(threepool_amount), int(ousd_amount)])
#         print(out[-1])


# print("-----")
# for line in out:
#     print(",".join([str(x) for x in line]))



# # Fixed deposit, slide OUSD

print("-----")
out = []
THREEPOOL_DEPOSIT_AMOUNT = int(5e6) * int(1e18)
MAX_OUSD_AMOUNT = int(5e6) * int(1e18)
for mint_ratio in range(0, 21, 1):
    mint_ratio = mint_ratio / 20.0
    with TemporaryFork():
        ousd_amount = MAX_OUSD_AMOUNT * int(mint_ratio * 100) // int(100)
        threepool_amount = THREEPOOL_DEPOSIT_AMOUNT
        total_deposit = ousd_amount + threepool_amount
        ousd_metapool.add_liquidity([ousd_amount, int(threepool_amount / threepool_virtual_price)], 0, me, OPTS)
        out.append([mint_ratio, ousd_metapool.balanceOf(me) * ousd_metapool_virtual_price / total_deposit, int(threepool_amount), int(ousd_amount)])
        print(out[-1])


print("-----")
for line in out:
    print(",".join([str(x) for x in line]))

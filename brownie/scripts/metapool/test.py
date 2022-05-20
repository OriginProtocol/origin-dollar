from metastrategy import *

with TemporaryFork():
    with SupplyChanges(OPTS):
        tiltMetapoolTo3CRV()
        mint(10e6)
        withdrawFromMeta(10e6)
        redeem(10e6)
        show_vault_holdings()

with TemporaryFork():
    with SupplyChanges(OPTS):
        tiltMetapoolToOUSD()
        mint(10e6)
        withdrawFromMeta(10e6)
        redeem(10e6)
        show_vault_holdings()


withdrawAllFromMeta()

#2. Deposit in metapool

# # Mix of funds

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

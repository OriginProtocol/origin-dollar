from metastrategy import *

with TemporaryFork():
    with SupplyChanges(OPTS):
        tiltMetapoolTo3CRV()
        mint(1e6)
        withdrawFromMeta(1e6)
        redeem(1e6)
        show_vault_holdings()

with TemporaryFork():
    with SupplyChanges(OPTS):
        tiltMetapoolToOUSD()
        mint(1e6)
        withdrawFromMeta(1e6)
        redeem(1e6)
        show_vault_holdings()


withdrawAllFromMeta()


# START OF REMOVING LIQUIDITY TEST
# test economic feasibility of removing liquidity in:
#   - imbalanced manner
#   - balanced manner and do an extra swap to make up for the imbalance

# test removal in an imbalanced manner
with TemporaryFork():
    # un-comment any of the below two to make the pool unbalanced
    #tiltMetapoolTo3CRV()
    #tiltMetapoolToOUSD()
    crv3Liquidity = 1e6*1e18 / threepool_swap.get_virtual_price() * 1e18
    # add 1 mio of 3crv and OUSD
    ousd_metapool.add_liquidity([1e6*1e18, crv3Liquidity], 0, me, OPTS)
    crv3Balance = threepool_lp.balanceOf(me, OPTS)
    ousdBalance = ousd.balanceOf(me, OPTS)

    # remove 1mio 3Crv and 0 of OUSD.
    # 1.2 mio of LP token is offered but not all shall be burned
    ousd_metapool.remove_liquidity_imbalance([0, crv3Liquidity], 1.2*crv3Liquidity, OPTS)
    # remove the remaining OUSD
    ousd_metapool.remove_liquidity_one_coin(ousd_metapool.balanceOf(me), 0, 0, OPTS)
    crv3diff = threepool_lp.balanceOf(me, OPTS) - crv3Balance
    ousdDiff = ousd.balanceOf(me, OPTS) - ousdBalance
    print("crv3Liquidity added: ", crv3Liquidity / 1e18)
    print("Withdrew {:0.1f} of 3CRV and {:0.1f} of OUSD and lost {:0.1f} OUSD".format(crv3diff/1e18, ousdDiff/1e18, 1e6 - ousdDiff/1e18))

# test removal in a balanced manner
with TemporaryFork():
    # un-comment any of the below two to make the pool unbalanced
    #tiltMetapoolTo3CRV()
    #tiltMetapoolToOUSD()

    crv3Liquidity = 1e6*1e18 / threepool_swap.get_virtual_price() * 1e18
    # add 1 mio of 3crv and OUSD
    ousd_metapool.add_liquidity([1e6*1e18, crv3Liquidity], 0, me, OPTS)
    crv3Balance = threepool_lp.balanceOf(me, OPTS)
    ousdBalance = ousd.balanceOf(me, OPTS)

    # remove all liquidity
    ousd_metapool.remove_liquidity(ousd_metapool.balanceOf(me), [0,0], OPTS)
    crv3Gained = threepool_lp.balanceOf(me, OPTS) - crv3Balance

    # more than 1 mio 3crv received, swap overhead 3crv to OUSD
    if (crv3Gained > crv3Liquidity):
        ousd_metapool.exchange(1, 0, crv3Gained - crv3Liquidity, 0, OPTS)
    # less than 1 mio 3crv received, swap overhead OUSD to 3crv
    else:
        crv3Required = crv3Liquidity - crv3Gained
        allOusd = crv3Required * 1.1 * threepool_swap.get_virtual_price() / 1e18
        crv3Received = ousd_metapool.get_dy(0, 1, allOusd,  OPTS)
        ousdToSwap = crv3Required / crv3Received * allOusd
        ousd_metapool.exchange(0, 1, ousdToSwap, 0, OPTS)

    crv3diff = threepool_lp.balanceOf(me, OPTS) - crv3Balance
    ousdDiff = ousd.balanceOf(me, OPTS) - ousdBalance
    print("crv3Liquidity added: ", crv3Liquidity / 1e18)
    print("Withdrew {:0.1f} of 3CRV and {:0.1f} of OUSD and lost {:0.1f} OUSD".format(crv3diff/1e18, ousdDiff/1e18, 1e6 - ousdDiff/1e18))

# END OF REMOVING LIQUIDITY TEST

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

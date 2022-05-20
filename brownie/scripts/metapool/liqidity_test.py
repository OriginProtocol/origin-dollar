from metastrategy import *

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

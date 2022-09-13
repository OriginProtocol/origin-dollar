from metastrategy import *

# test economic feasibility of adding liquidity/removing liquidity with permutations:
# [adding liquidity]:
#   - 50/50 strategy -> same amount of dollar value 3crv & OUSD
#   - balanced pool strategy -> so that 3crv pool ends up balanced
#
# [3crv_OUSD metapool being]
#   - balanced -> same amount of 3crv & OUSD liquidity
#   - tilted towards 3crv
#   - tilted towards OUSD
#
# [removing liquidity]:
#   - imbalanced manner -> get required amount of 3crv first and then remove the rest of OUSD
#   - balanced manner -> let the balance of the pool decide the amount of each coin we get and do a 
#     swap afterwards to make up for the difference of a coin we require

def main():
    with TemporaryFork():
        # always leave the balancing call. Even if we want to tilt the pool we first want to balance
        # it to mitigate the pre-existing state
        balance_metapool(ousd_metapool)

        # un-comment any of the below two to make the initial state of the pool balanced/unbalanced
        #tiltMetapoolTo3CRV(ousd_metapool, 0.25*1e6*1e18)
        tiltMetapoolToMainCoin(ousd_metapool, 0.25*1e6*1e18)

        show_metapool_balances(ousd_metapool)
        # un-comment any of the liquidity adding strategies
        # [crv3LiquidityAdded, ousdLiquidityAdded, lp_added] = addEqualLiquidity()
        [crv3LiquidityAdded, ousdLiquidityAdded, lp_added] = addLiquidityToBeEqualInPool()
        # [crv3LiquidityAdded, ousdLiquidityAdded, lp_added] = addTwiceTheOUSD()
        show_metapool_balances(ousd_metapool)
        # un-comment any of the liquidity removing strategies
        removeLiquidityBalanced(crv3LiquidityAdded, ousdLiquidityAdded, lp_added)
        #removeLiquidityImbalanced(crv3LiquidityAdded, ousdLiquidityAdded, lp_added)

        show_metapool_balances(ousd_metapool)

def removeLiquidityImbalanced(crv3LiquidityAdded, ousdLiquidityAdded, lp_added):
    crv3Balance = threepool_lp.balanceOf(me, OPTS)
    ousdBalance = ousd.balanceOf(me, OPTS)

    # remove 1mio 3Crv and 0 of OUSD.
    # 1.2 factor of LP token is offered but not all shall be burned
    ousd_metapool.remove_liquidity_imbalance([0, crv3LiquidityAdded], 1.2*crv3LiquidityAdded, OPTS)
    # remove the remaining OUSD
    ousd_metapool.remove_liquidity_one_coin(ousd_metapool.balanceOf(me), 0, 0, OPTS)
    crv3diff = threepool_lp.balanceOf(me, OPTS) - crv3Balance
    ousdDiff = ousd.balanceOf(me, OPTS) - ousdBalance

    print("crv3:", crv3LiquidityAdded / 1e18, " and OUSD: ", ousdLiquidityAdded / 1e18, " liquidity added to the pool. Resulting in ", lp_added / 1e18, " LP")
    print("Withdrew {:0.1f} 3CRV and {:0.1f} OUSD and lost {:0.1f} OUSD".format(crv3diff/1e18, ousdDiff/1e18, (ousdLiquidityAdded - ousdDiff)/1e18))


def removeLiquidityBalanced(crv3LiquidityAdded, ousdLiquidityAdded, lp_added):
    crv3Balance = threepool_lp.balanceOf(me, OPTS)
    ousdBalance = ousd.balanceOf(me, OPTS)

    # remove all liquidity
    ousd_metapool.remove_liquidity(ousd_metapool.balanceOf(me), [0,0], OPTS)
    crv3Gained = threepool_lp.balanceOf(me, OPTS) - crv3Balance

    # more than 1 mio 3crv received, swap overhead 3crv to OUSD
    if (crv3Gained > crv3LiquidityAdded):
        ousd_metapool.exchange(1, 0, crv3Gained - crv3LiquidityAdded, 0, OPTS)
    # less than 1 mio 3crv received, swap overhead OUSD to 3crv
    else:
        crv3Required = crv3LiquidityAdded - crv3Gained
        allOusd = crv3Required * 1.1 * threepool_swap.get_virtual_price() / 1e18
        crv3Received = ousd_metapool.get_dy(0, 1, allOusd,  OPTS)
        ousdToSwap = crv3Required / crv3Received * allOusd
        ousd_metapool.exchange(0, 1, ousdToSwap, 0, OPTS)

    crv3diff = threepool_lp.balanceOf(me, OPTS) - crv3Balance
    ousdDiff = ousd.balanceOf(me, OPTS) - ousdBalance

    print("crv3:", crv3LiquidityAdded / 1e18, " and OUSD: ", ousdLiquidityAdded / 1e18, " liquidity added to the pool. Resulting in ", lp_added / 1e18, " LP")
    print("Withdrew {:0.1f} 3CRV and {:0.1f} OUSD and lost {:0.1f} OUSD".format(crv3diff/1e18, ousdDiff/1e18, (ousdLiquidityAdded - ousdDiff)/1e18))


# add liquidity - so that we add twice the OUSD comparing to 3CRV
def addTwiceTheOUSD(crv3_to_add=1e6*1e18):
    crv3Liquidity = crv3_to_add / threepool_swap.get_virtual_price() * 1e18
    ousd_to_add = crv3_to_add * 2

    # add liquidity
    lp_before = ousd_metapool.balanceOf(me)
    ousd_metapool.add_liquidity([ousd_to_add, crv3Liquidity], 0, me, OPTS)
    lp_after = ousd_metapool.balanceOf(me)
    return [crv3Liquidity, ousd_to_add, lp_after-lp_before]

# add liquidity - so that the pool ends up balanced after liquidity added
def addLiquidityToBeEqualInPool(crv3_to_add=1e6*1e18):
    crv3Liquidity = crv3_to_add / threepool_swap.get_virtual_price() * 1e18
    ousdPoolBalance = ousd_metapool.balances(0)
    crv3PoolBalance = ousd_metapool.balances(1)
    ousd_to_add = crv3PoolBalance - ousdPoolBalance + crv3Liquidity
    if ousd_to_add < 0:
        ousd_to_add = 0

    # add liquidity
    lp_before = ousd_metapool.balanceOf(me)
    ousd_metapool.add_liquidity([ousd_to_add, crv3Liquidity], 0, me, OPTS)
    lp_after = ousd_metapool.balanceOf(me)
    return [crv3Liquidity, ousd_to_add, lp_after-lp_before]

# add liquidity - supply requested dollar values of CRV3 & ousd supplied to the function
def addEqualLiquidity(crv3_to_add=1e6*1e18, ousd_to_add=1e6*1e18):
    crv3Liquidity = crv3_to_add / threepool_swap.get_virtual_price() * 1e18
    # add liquidity
    lp_before = ousd_metapool.balanceOf(me)
    ousd_metapool.add_liquidity([ousd_to_add, crv3Liquidity], 0, me, OPTS)
    lp_after = ousd_metapool.balanceOf(me)
    return [crv3Liquidity, ousd_to_add, lp_after-lp_before]


# with TemporaryFork():
#     set_no_collateral_minter(me)

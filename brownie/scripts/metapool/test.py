from metastrategy import *
harvest_all_strategies()
vault_core.rebase(OPTS)

# do a lot of mints/redeems on the strategy.
# result: 
# balanced pool - vault & OUSD balances go up for 1 mio mainly because of redeem fees. 
#                 caller is down 630k on stablecoins. 277k OUSD that has been minted for
#                 strategy "stays in the wild" Metapool continues to be relatively balanced (0.5mio diff)
#                 Average user gained 1.2% of OUSD balance increase
# 3CRV pool tilt- vault & OUSD balances go up for 11.2 mio. 10.4 OUSD that has been minted by strategy
#                 caller is down 630k on stablecoins. 277k OUSD that has been minted for
#                 strategy "stays in the wild" Metapool continues to be relatively balanced (0.5mio diff)
#                 Average user gained 1.1% of OUSD balance increase
# OUSD pool tilt- vault & OUSD balances go down for 2.4 mio. 3.2 OUSD has been burned for strategy
#                 caller is down 672k on stablecoins.Metapool continues to be relatively balanced (0.5mio diff)
#                 Average user gained 1.3% of OUSD balance increase
# NOTE: users gaining OUSD is mainly because of redeem fees
with TemporaryFork():
    # Option 1
    balance_metapool()
    # Option 2
    #tiltMetapoolTo3CRV()
    # Option 3
    #tiltMetapoolToOUSD(5*1e6*1e18)
    with AccountOUSDBalance(OPTS):
        with SupplyChanges(OPTS):
            with ObserveMeBalances(OPTS):
                with MetapoolBalances(OPTS):
                    with Crv3Balances(OPTS):
                        for x in range(30):
                            mint(10e6)
                            withdrawAllFromMeta()
                            redeem(10e6)
                        show_vault_holdings()



# tilt pools between the mints and redeems
# result: 
# balanced pool - vault & OUSD balances go up for 2 mio mainly mainly because of extra 1.6 mio OUSD minted
#                 for strategy. 'me' account traded a lot of USDT for USSC/DAI and is generally up by 1.3 mio
#                 Average user gained 0.6% OUSD. 
#                 NEEDS further investigation. (!) who is the loser here?
# 3CRV pool tilt- vault & OUSD balances go up for 24 mio mainly mainly because of extra 23.6 mio OUSD minted
#                 for strategy. 'me' account traded a lot of USDT for USSC/DAI and is generally up by 23 mio
#                 Average user gained 0.5% OUSD. 
#                 NEEDS further investigation. (!) who is the loser here?
# OUSD pool tilt- has issues being ran
# NOTE: users gaining OUSD is mainly because of redeem fees
with TemporaryFork():
    balance_metapool()
    with AccountOUSDBalance(OPTS):
        with SupplyChanges(OPTS):
            with ObserveMeBalances(OPTS):
                with MetapoolBalances(OPTS):
                    with Crv3Balances(OPTS):
                        for x in range(15):
                            mint(10e6)
                            # Option 1
                            balance_metapool()
                            # Option 2
                            #tiltMetapoolTo3CRV(5*1e6*1e18)
                            # Option 3
                            #tiltMetapoolToOUSD(5*1e6*1e18)
                            withdrawAllFromMeta()
                            redeem(10e6)
                            balance_metapool()



# TODO Test different deposit strategies and what could be dangerous
with TemporaryFork():
    with ObserveMeBalances(OPTS):
        usdt.approve(threepool_swap.address, int(1e50), OPTS)
        threepool_swap.exchange(2,1,200*1e12, 0, OPTS)



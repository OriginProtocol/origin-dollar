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
                show_metapool_balances()
                for x in range(30):
                    mint(10e6)
                    withdrawAllFromMeta()
                    redeem(10e6)
                show_vault_holdings()
                show_metapool_balances()



# tilt pools between the mints and redeems
with TemporaryFork():
    balance_metapool()
    with AccountOUSDBalance(OPTS):
        with SupplyChanges(OPTS):
            with ObserveMeBalances(OPTS):
                show_metapool_balances()
                mint(10e6)
                withdrawAllFromMeta()
                redeem(10e6)
                show_vault_holdings()
                show_metapool_balances()

# TODO Test different deposit strategies and what could be dangerous


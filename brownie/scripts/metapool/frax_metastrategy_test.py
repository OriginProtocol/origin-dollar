from metastrategy import *
harvest_all_strategies()
vault_core.rebase(OPTS)

def main():
    with TemporaryFork():
        # Option 1
        #balance_metapool(frax_metapool)
        # Option 2
        # tiltMetapoolTo3CRV(ousd_metapool)
        # Option 3
        # tiltMetapoolToMainCoin(ousd_metapool, 5*1e6*1e18)
        with SupplyChanges(OPTS):
            with ObserveMeBalances(OPTS):
                with MetapoolBalances(OPTS, frax_metapool):
                    with Crv3Balances(OPTS):
                        mint(10e6)
                        #withdrawAllFromMeta(FRAX_STRATEGY)
                        print("REdeeming")
                        redeem(9e6)
                        show_vault_holdings()
                        #balance_metapool(ousd_metapool)


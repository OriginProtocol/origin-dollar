from metastrategy import *
harvest_all_strategies()
vault_core.rebase(OPTS)

# test deposit funds and reallocation
def main():
    with TemporaryFork():
        with MetapoolBalances(OPTS, frax_metapool):
            mint(10e6)
        show_vault_holdings()
        reallocate(META_STRATEGY, AAVE_STRAT, USDT, 10e12 - 1e4 * 1e6) # 10k USDT less than 10 mio (0.1%)
        show_vault_holdings()


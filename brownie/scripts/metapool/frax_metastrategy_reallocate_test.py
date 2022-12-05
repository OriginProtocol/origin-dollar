from metastrategy import *
harvest_all_strategies()
vault_core.rebase(OPTS)

# test deposit funds and reallocation
def main():
    with TemporaryFork():
        with MetapoolBalances(OPTS, frax_metapool):
            mint(10e6)
        show_vault_holdings()
        reallocate(FRAX_STRATEGY, AAVE_STRAT, usdt, 10e6 - 1e4) # 10k USDT less than 10 mio (0.1%)
        show_vault_holdings()


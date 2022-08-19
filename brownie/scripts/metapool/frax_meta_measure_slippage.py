from metastrategy import *

# test deposit funds and reallocation
def main():
    in_first_precision = True
    mint_amount = 10e6
    relocate_step = 0.0001
    secondary_precision_step = relocate_step / 10

    def preparePool():
        # Option 1
        tiltMetapoolTo3CRV(frax_metapool, 150*1e6*1e18)
        # Option 2
        # tiltMetapoolToMainCoin(frax_metapool, 300*1e6*1e18)
        with MetapoolBalances(OPTS, frax_metapool):
            mint(mint_amount)

    with TemporaryFork():
        preparePool()
        relocationSuccessful = False
        redeem_amount = mint_amount
        first_precision_counter = 0
        second_precision_counter = 0
        while not relocationSuccessful:
            if in_first_precision:
                first_precision_counter += 1
            else:
                second_precision_counter += 1

            redeem_amount = mint_amount - relocate_step * mint_amount * first_precision_counter - secondary_precision_step * mint_amount * second_precision_counter
            try:
                result = reallocate(FRAX_STRATEGY, AAVE_STRAT, usdt, redeem_amount)
                if in_first_precision:
                    # explore seconds precision step of relocation
                    in_first_precision = False
                    # roll back one step and try to succeed one level deeper
                    first_precision_counter -= 1
                    print("Reallocation with " + str(redeem_amount) + " successful. Exploring a deeper precision")
                    # revert back to snapshot
                    brownie.chain.revert()
                    preparePool()
                else:
                    # exit
                    relocationSuccessful = True
            except:
                print("Reallocation with " + str(redeem_amount) + " failed")
        print("Reallocation with " + str(redeem_amount) + " successful. Incurred: " + str((mint_amount - redeem_amount) / mint_amount * 100) + " % slippage" )
        show_vault_holdings()


from world import *
import collateral_swap
import sys
import contextlib

def main():
    def get_1inch_quote(from_token, to_token, from_amount):
        return from_amount
    def get_oracle_router_quote(from_token, to_token, from_amount):
        return from_amount
    def get_coingecko_quote(from_token, to_token, from_amount):
        return from_amount
    def get_cmc_quote(from_token, to_token, from_amount):
        return from_amount

    def print_test_success(fn):
        print("✅ {} succeeded".format(fn.__name__))

    def print_test_fail(fn):
        print("❌ {} failed".format(fn.__name__))

    def should_run_normally(fn):
        try:
            with contextlib.redirect_stdout(None):
                fn()
        except Exception as e:
            print_test_fail(fn)
            raise e
        
        print_test_success(fn)

    def should_raise_exception(fn, exception_message):
        try:
            with contextlib.redirect_stdout(None):
                fn()
            print_test_fail(fn)
        except Exception as e:
            if exception_message not in str(e):
                print_test_fail(fn)
                raise Exception('Incorrect error thrown. Should be: "{}" error was: "{}"'.format(exception_message, str(e)))
            print_test_success(fn)
        else:
            print_test_fail(fn)
            raise Exception('Exception not thrown. Expected exception with message: "{}"'.format(exception_message))

    def override_module_functions(get_1inch_quote, get_oracle_router_quote, get_coingecko_quote, get_cmc_quote):
        collateral_swap.get_1inch_quote = get_1inch_quote
        collateral_swap.get_oracle_router_quote = get_oracle_router_quote
        collateral_swap.get_coingecko_quote = get_coingecko_quote
        collateral_swap.get_cmc_quote = get_cmc_quote

    def generate_price_test():
        override_module_functions(get_1inch_quote, get_oracle_router_quote, get_coingecko_quote, get_cmc_quote)
        collateral_swap.build_swap_tx(WETH, FRXETH, 300 * 10**18, 1, False)

    def generate_price_slippage_error_test():
        min_slippage_amount = 10**18

        def get_1inch_quote(from_token, to_token, from_amount):
            if from_amount == min_slippage_amount:
                return from_amount
            else:
                # Simulate 20% slippage
                return from_amount * 0.8

        override_module_functions(get_1inch_quote, get_oracle_router_quote, get_coingecko_quote, get_cmc_quote)
        collateral_swap.build_swap_tx(WETH, FRXETH, 300 * 10**18, 1, False)

    def price_deviation_error_test():
        def get_coingecko_quote(from_token, to_token, from_amount):
            # Simulate 3% price deviation
            return from_amount * 1.03

        override_module_functions(get_1inch_quote, get_oracle_router_quote, get_coingecko_quote, get_cmc_quote)
        collateral_swap.build_swap_tx(WETH, FRXETH, 300 * 10**18, 1, False)


    # Run the actual tests

    # should succeed
    should_run_normally(generate_price_test)

    # should fail with slippage error
    should_raise_exception(generate_price_slippage_error_test, 'Slippage larger than expected')

    # should fail with price deviation
    should_raise_exception(price_deviation_error_test, '1Inch and Coingecko have too large price deviation')

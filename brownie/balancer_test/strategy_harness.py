# Tilt Tester
from world import *
from brownie import chain
import random
import pandas as pd

WSTETH_WHALE = "0x176f3dab24a159341c0509bb36b833e7fdd0a132"
WETH_WHALE = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28"
WETH_WHALE2 = "0xf04a5cc80b1e94c69b48f5ee68a08cd2f09a7c3e"
RETH_WHALE = "0xCc9EE9483f662091a1de4795249E24aC0aC2630f"
RETH_WHALE2 = "0xC6424e862f1462281B0a5FAc078e4b63006bDEBF"
strat_address = "0x85094b52754591A3dE0002AD97F433584389aea0"

do_it_fast = False

class BalancerRethEth:
    def __init__(self):
        pool_address = "0x1E19CF2D73a72Ef1332C882F20534B6519Be0276"
        self.strat = load_contract("balancer_strat", strat_address)
        self.pool = load_contract("balancer_metastablepool", pool_address)
        self.name = "Balancer Steth-Eth Metastable"
        self.vault_core = oeth_vault_core
        self.vault_admin = oeth_vault_admin
        self.base_size = 2000

        self.strat.setMaxDepositDeviation(1e18, {'from': STRATEGIST}) # == 100%
        self.strat.setMaxWithdrawalDeviation(4 * 1e18, {'from': STRATEGIST}) # == 100%
        self._balancer_vault = load_contract("balancer_vault", self.pool.getVault())
        self._pool_pid = "0x1e19cf2d73a72ef1332c882f20534b6519be0276000200000000000000000112"
        self._pool_tokens = self.pool_balances().keys()
        self.rethExchangeRate = reth.getExchangeRate()

        reth.approve(self._balancer_vault, 1e70, {'from': RETH_WHALE})
        weth.approve(self._balancer_vault, 1e70, {'from': WETH_WHALE})

    def pool_balances(self):
        balances =  self._balancer_vault.getPoolTokens(self._pool_pid)[0:2] 
        return dict(zip(balances[0], balances[1]))

    def to_reth_amount(self, amount):
        return amount * 1e18 / self.rethExchangeRate

    def from_reth_to_units(self, amount):
        return amount * self.rethExchangeRate / 1e18

    # put the pool to exact 50%/50% share
    def balance_pool(self):
        (reth_balance, weth_balance) = list(harness.pool_balances().values())
        reth_unit_balance = self.from_reth_to_units(reth_balance)

        if reth_unit_balance > weth_balance:
            # convert from unit amount to reth amoount
            weth_amount = (reth_unit_balance - weth_balance) / 2
            # swapping WETH specified by amount for RETH
            self._balancer_vault.swap((self._pool_pid, 0, WETH, RETH, weth_amount, ""), (WETH_WHALE, False, WETH_WHALE, False), 1, chain.time()+100, {"from": WETH_WHALE})
        else:
            to_reth_amount = self.to_reth_amount(weth_balance - reth_unit_balance) / 2
            # swapping RETH specified by amount for WETH
            self._balancer_vault.swap((self._pool_pid, 0, RETH, WETH, to_reth_amount, ""), (RETH_WHALE, False, RETH_WHALE, False), 1, chain.time()+100, {"from": RETH_WHALE})

    def tilt_pool(self, size):
        self.balance_pool()
        amount = abs(size) * self.base_size * int(1e18)
        if size == 0:            
            pass
        elif size > 0:
            # swapping WETH specified by amount for RETH
            self._balancer_vault.swap((self._pool_pid, 0, WETH, RETH, amount, ""), (WETH_WHALE, False, WETH_WHALE, False), 1, chain.time()+100, {"from": WETH_WHALE})
        else:
            # swapping RETH specified by amount for WETH
            self._balancer_vault.swap((self._pool_pid, 0, RETH, WETH, self.to_reth_amount(amount), ""), (RETH_WHALE, False, RETH_WHALE, False), 1, chain.time()+100, {"from": RETH_WHALE})
            
    def pool_create_mix(self, tilt=0.5, size=1):
        return {
            # account for rethExchangeRate
            RETH: self.to_reth_amount(int(size * self.base_size * (int(1e18)-(int(1e18) * tilt)))),
            WETH: int(size * self.base_size * int(1e18) * tilt),
        }

harness = BalancerRethEth()

# Run setup
try:
  harness.vault_admin.withdrawAllFromStrategies({'from':STRATEGIST})
except:
  print("Withdraw all failed")

harness.vault_admin.withdrawAllFromStrategy(harness.strat, {'from':STRATEGIST})
if (weth.balanceOf(harness.vault_admin) < 2e4 * int(1e18)):
    weth.transfer(harness.vault_admin, 2e4 * int(1e18), {'from': WETH_WHALE2})
if (reth.balanceOf(harness.vault_admin) < 2e4 * int(1e18)):
    reth.transfer(harness.vault_admin, 2e4 * int(1e18), {'from': RETH_WHALE2})

# Test Deposits

deposit_stats = []
steps = 20 if do_it_fast else 60
for initial_tilt in [0.0, -1, -3,  1, 3]:
#for initial_tilt in [0.0]:
    for deposit_x in range (0, steps + 1, 1):
    #for deposit_mix in [0.4, 0.45]:
        with TemporaryFork():
            stat = {}

            deposit_mix = deposit_x / steps

            stat['action'] = 'deposit'
            stat['action_mix'] = deposit_mix

            stat['start_vault'] = harness.vault_core.totalValue()
            stat['start_value_in_vault'] = harness.vault_core.totalValueInVault()
            stat['start_strat_check_balance'] = harness.strat.checkBalance()

            initial_deposit = harness.pool_create_mix(tilt=0.5, size=1.5)
            harness.vault_admin.depositToStrategy(harness.strat, list(initial_deposit.keys()), list(initial_deposit.values()), {'from':STRATEGIST})

            stat['pre_vault'] = harness.vault_core.totalValue()
            pb = list(harness.pool_balances().values())
            stat['pre_pool_0'] = pb[0]
            stat['pre_pool_1'] = pb[1]

            harness.tilt_pool(initial_tilt)

            stat['before_vault'] = harness.vault_core.totalValue()
            stat['before_value_in_vault'] = harness.vault_core.totalValueInVault()
            stat['before_strat_check_balance'] = harness.strat.checkBalance()
            pb = list(harness.pool_balances().values())
            stat['before_pool_0'] = pb[0]
            stat['before_pool_1'] = pb[1]
            
            deposit = harness.pool_create_mix(deposit_mix, size=1)
            harness.vault_admin.depositToStrategy(harness.strat, list(deposit.keys()), list(deposit.values()), {'from':STRATEGIST})

            stat['after_vault'] = harness.vault_core.totalValue()
            stat['after_strat_check_balance'] = harness.strat.checkBalance()
            stat['after_value_in_vault'] = harness.vault_core.totalValueInVault()
            pb = list(harness.pool_balances().values())
            stat['after_pool_0'] = pb[0]
            stat['after_pool_1'] = pb[1]

            # after after
            harness.vault_admin.withdrawAllFromStrategy(harness.strat, {'from':STRATEGIST})

            stat['end_vault'] = harness.vault_core.totalValue()
            stat['end_strat_check_balance'] = harness.strat.checkBalance()
            stat['end_value_in_vault'] = harness.vault_core.totalValueInVault()


            # profit = stat['after_vault'] - stat['before_vault']
            # end_profit = stat['end_vault'] - stat['start_vault']
            # if (profit > 0):
            #     profit_strat = stat['after_strat_check_balance'] - stat['before_strat_check_balance']
            #     profit_strat += stat['after_value_in_vault'] - stat['before_value_in_vault']

            #     end_value_in_vault_profit = stat['end_value_in_vault'] - stat['start_value_in_vault']

            #     print("PROFITING at MIX ", deposit_mix, deposit)
            #     print("Vault profit ", profit / 1e18)
            #     print("Strategy checkBalance() profit ", profit_strat / 1e18)
            #     print("End vault profit ", end_profit / 1e18)
            #     print("Value in vault diff ", end_value_in_vault_profit / 1e18)
            #     print("before_pool_0", stat['before_pool_0'] / 1e18)
            #     print("before_pool_1", stat['before_pool_1'] / 1e18)

            #     total_in_pool = harness.from_reth_to_units(stat['before_pool_0']) + stat['before_pool_1']
            #     print("reth_share", harness.from_reth_to_units(stat['before_pool_0']) / total_in_pool)
            #     print("weth_share", stat['before_pool_1'] / total_in_pool)

            deposit_stats.append(stat)

pd.DataFrame.from_records(deposit_stats).to_csv("deposit_stats.csv")


# Test Balances

balance_stats = []
steps = 5 if do_it_fast else 20
for initial_tilt in [0.0, -1, -3,  1, 3]:
    for deposit_x in range (0, steps + 1, 1):
        with TemporaryFork():
            stat = {}

            test_tilt = deposit_x / (steps / 2) - 1 

            stat['action'] = 'balance'
            stat['action_mix'] = test_tilt

            initial_deposit = harness.pool_create_mix(tilt=0.5, size=1.5)
            harness.vault_admin.depositToStrategy(harness.strat, list(initial_deposit.keys()), list(initial_deposit.values()), {'from':STRATEGIST})

            stat['pre_vault'] = harness.vault_core.totalValue()
            pb = list(harness.pool_balances().values())
            stat['pre_pool_0'] = pb[0]
            stat['pre_pool_1'] = pb[1]

            harness.tilt_pool(initial_tilt)


            stat['before_vault'] = harness.vault_core.totalValue()
            pb = list(harness.pool_balances().values())
            stat['before_pool_0'] = pb[0]
            stat['before_pool_1'] = pb[1]


            harness.tilt_pool(initial_tilt)

            stat['after_vault'] = harness.vault_core.totalValue()
            pb = list(harness.pool_balances().values())
            stat['after_pool_0'] = pb[0]
            stat['after_pool_1'] = pb[1]

            balance_stats.append(stat)

pd.DataFrame.from_records(balance_stats).to_csv("balance_stats.csv")


# Test Withdraws

withdraw_stats = []
steps = 5 if do_it_fast else 20
for initial_tilt in [0.0, -1, -3,  1, 3]:
    for deposit_x in range (0, steps + 1, 1):
        with TemporaryFork():
            stat = {}

            deposit_mix = deposit_x / steps

            stat['action'] = 'withdraw'
            stat['action_mix'] = deposit_mix

            initial_deposit = harness.pool_create_mix(tilt=0.5, size=1)
            harness.vault_admin.depositToStrategy(harness.strat, list(initial_deposit.keys()), list(initial_deposit.values()), {'from':STRATEGIST})

            stat['pre_vault'] = harness.vault_core.totalValue()
            pb = list(harness.pool_balances().values())
            stat['pre_pool_0'] = pb[0]
            stat['pre_pool_1'] = pb[1]

            harness.tilt_pool(initial_tilt)

            stat['before_vault'] = harness.vault_core.totalValue()
            pb = list(harness.pool_balances().values())
            stat['before_pool_0'] = pb[0]
            stat['before_pool_1'] = pb[1]
            
            withdraw = harness.pool_create_mix(deposit_mix, size=0.4)
            try:
                harness.vault_admin.withdrawFromStrategy(harness.strat, list(withdraw.keys()), list(withdraw.values()), {'from':STRATEGIST})
            except:
                print("WITHDRAWAL FAILED")

            stat['after_vault'] = harness.vault_core.totalValue()
            pb = list(harness.pool_balances().values())
            stat['after_pool_0'] = pb[0]
            stat['after_pool_1'] = pb[1]

            withdraw_stats.append(stat)

pd.DataFrame.from_records(withdraw_stats).to_csv("withdraw_stats.csv")


# Test WithdrawAll

withdrawall_stats = []
steps = 5 if do_it_fast else 100
for initial_tilt in range (0, steps + 1, 1):
    with TemporaryFork():
        stat = {}

        initial_tilt = (initial_tilt / steps - 0.5) * 4

        stat['action'] = 'withdrawall'
        stat['action_mix'] = initial_tilt

        initial_deposit = harness.pool_create_mix(tilt=0.5, size=1.5)
        harness.vault_admin.depositToStrategy(harness.strat, list(initial_deposit.keys()), list(initial_deposit.values()), {'from':STRATEGIST})

        stat['pre_vault'] = harness.vault_core.totalValue()
        pb = list(harness.pool_balances().values())
        stat['pre_pool_0'] = pb[0]
        stat['pre_pool_1'] = pb[1]

        harness.tilt_pool(initial_tilt)

        stat['before_vault'] = harness.vault_core.totalValue()
        pb = list(harness.pool_balances().values())
        stat['before_pool_0'] = pb[0]
        stat['before_pool_1'] = pb[1]
        
        harness.vault_admin.withdrawAllFromStrategy(harness.strat, {'from':STRATEGIST})

        stat['after_vault'] = harness.vault_core.totalValue()
        pb = list(harness.pool_balances().values())
        stat['after_pool_0'] = pb[0]
        stat['after_pool_1'] = pb[1]

        withdrawall_stats.append(stat)

pd.DataFrame.from_records(withdrawall_stats).to_csv("withdrawall_stats.csv")
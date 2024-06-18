import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import re
from pathlib import Path
from brownie import *
from base_world import *


NUM_DEPOSIT_TESTS_EACH = 5
NUM_BALANCE_TESTS_EACH = 5
NUM_WITHDRAW_TESTS_EACH = 5
NUM_WITHDRAWALL_TESTS_EACH = 5


class AerodromeWeth:
    def __init__(self):
        strat_address = "0x885a4D0b5070faB2C8F58B86fD196974cDe4feCd"
        pool_address = "0xF7380521b2F888246061f35f58191685Bdd8fCc0" # aero pool (forked)
        self.strat = load_contract("aero_strat", strat_address)
        self.aero_pool = load_contract("aero_pool", pool_address)
        self.aero_router = load_contract("aero_router", AERO_ROUTER_ADDRESS)
        self.name = "Aerodrome WETH"
        self.vault_core = oeth_vault_core
        self.vault_admin = oeth_vault_admin
        self.base_size = 200
        self.oeth= oeth
 
    def setup(self):
        oeth.approve(self.aero_router, 1e70, {"from": JOSH})
        weth.approve(self.aero_router, 1e70, {"from": JOSH})
        weth.transfer(OETH_VAULT, 1000e18, {"from":JOSH})
        # self.aero_router.swapExactTokensForTokens(
        #         50e18,           # amountIn
        #         0,                # amountOutMin 
        #         [['0xa0ba4fa6c1E25DCEEAE90B56da024376FDb34efB', '0x4200000000000000000000000000000000000006', True, '0x420DD381b31aEf6683db6B902084cB0FFECe40Da']],
        #         JOSH,      
        #         1749091044,        # one year from now
        #         {"from": JOSH},
        #     )
        
        

    def pool_balances(self):
        reserves = self.aero_pool.getReserves()
        keys = ['reserve0', 'reserve1']
        return dict(zip(keys, reserves[:2]))

    def tilt_pool(self, size):
        amount = abs(size) * self.base_size * int(1e18)
        print("Tilt pool",  abs(size) * self.base_size)
        if size > -0.00001 and size < 0.00001:
            print("skip tilt")
            pass
        elif size > 0:
            self.aero_router.swapExactTokensForTokens(
                amount,           # amountIn
                0,                # amountOutMin 
                [['0x4200000000000000000000000000000000000006', '0xa0ba4fa6c1E25DCEEAE90B56da024376FDb34efB', True, '0x420DD381b31aEf6683db6B902084cB0FFECe40Da']],
                JOSH,      
                1749091044,        # one year from now
                {"from": JOSH},
            )
        else:
            self.aero_router.swapExactTokensForTokens(
                amount,           # amountIn
                0,                # amountOutMin
                [['0xa0ba4fa6c1E25DCEEAE90B56da024376FDb34efB', '0x4200000000000000000000000000000000000006', True, '0x420DD381b31aEf6683db6B902084cB0FFECe40Da']],
                JOSH,      
                1749091044,       # one year from now
                {"from": JOSH},
            )           

    def pool_create_mix(self, tilt=0.5, size=1):
        return {
          #  OETH: 2 + int(size * self.base_size * (int(1e18) - (int(1e18) * tilt))),
            WETH: 2 + int(size * self.base_size * int(1e18) * tilt),
        }


# # --------------


def _getHarness(name):
    return AerodromeWeth()  # YAGNI


def _getWorkspace(name):
    clean = re.sub(r"\W+", "", name)
    if clean != name:
        raise BaseException("Strategy name not alphanumeric")
    workspace = Path("reports/" + clean)
    workspace.mkdir(parents=True, exist_ok=True)
    return str(workspace.absolute()) + "/"


def _load_data(filename):
    base = pd.read_csv(filename)
    for x in base:
        if " " in x or "action" in x:
            continue
        else:
            base[x] = base[x].apply(int)
    base["pre_mix"] = base["pre_pool_0"] / (base["pre_pool_0"] + base["pre_pool_1"])
    base["before_mix"] = base["before_pool_0"] / (
        base["before_pool_0"] + base["before_pool_1"]
    )
    base["after_mix"] = base["after_pool_0"] / (
        base["after_pool_0"] + base["after_pool_1"]
    )
    base["before_profit"] = base["before_vault"] - base["pre_vault"]
    base["after_profit"] = (base["after_vault"] - base["before_vault"]) + (base["before_oeth_supply"] - base["after_oeth_supply"])
    return base


def main():
    print("Please use: brownie run strategy_report run_complete <STRATEGY_NAME>")
    pass


def run_complete(strategy_name):
    run_simulations(strategy_name)
    run_report(strategy_name)


def run_simulations(strategy_name):
    workspace = _getWorkspace(strategy_name)
    print("Harness start")
    harness = _getHarness(strategy_name)
    print("Harness end")

    # Run setup
    harness.setup()
    print("Harness setup done");
    try:
        harness.vault_admin.withdrawAllFromStrategies({"from": STRATEGIST})
    except:
        pass

    print("withdrawAllFromStrategies done");

  #  Test Deposits
    deposit_stats = []
    for initial_tilt in [0.0, -1, 1, 0.5, -0.5, 0.25, -0.25, 0.75, -0.75]:
        for deposit_x in range(0, NUM_DEPOSIT_TESTS_EACH + 1):
            print("TemporaryFork starts");

            with TemporaryFork():
                stat = {}

                deposit_mix = deposit_x / NUM_DEPOSIT_TESTS_EACH

                stat["action"] = "deposit"
                stat["action_mix"] = deposit_mix
                print("pool_create_mix starts");
                initial_deposit = harness.pool_create_mix(tilt=0.5, size=1.5)
                print("pool_create_mix ends", initial_deposit);
                harness.vault_admin.depositToStrategy(
                    harness.strat,
                    list(initial_deposit.keys()),
                    list(initial_deposit.values()),
                    {"from": STRATEGIST},
                )
                print("depositToStrategy ends");
                stat["pre_vault"] = harness.vault_core.totalValue()
                pb = list(harness.pool_balances().values())
                stat["pre_pool_0"] = pb[0]
                stat["pre_pool_1"] = pb[1]

                harness.tilt_pool(initial_tilt)

                stat["before_vault"] = harness.vault_core.totalValue()
                pb = list(harness.pool_balances().values())
                stat["before_pool_0"] = pb[0]
                stat["before_pool_1"] = pb[1]

                deposit = harness.pool_create_mix(deposit_mix, size=1)
                print("pool_create_mix 2", deposit);
                stat["before_oeth_supply"] = harness.oeth.totalSupply()
                harness.vault_admin.depositToStrategy(
                    harness.strat,
                    list(deposit.keys()),
                    list(deposit.values()),
                    {"from": STRATEGIST},
                )
                stat["after_oeth_supply"] = harness.oeth.totalSupply()
                print("depositToStrategy 2 ends");

                stat["after_vault"] = harness.vault_core.totalValue()
                pb = list(harness.pool_balances().values())
                stat["after_pool_0"] = pb[0]
                stat["after_pool_1"] = pb[1]

                deposit_stats.append(stat)
    pd.DataFrame.from_records(deposit_stats).to_csv(workspace + "deposit_stats.csv")

    # Test Balances

    balance_stats = []
    for initial_tilt in [0.0, -1, -2, 1, 2]:
        for deposit_x in range(0, NUM_BALANCE_TESTS_EACH + 1, 1):
            try:
                with TemporaryFork():
                    stat = {}

                    test_tilt = deposit_x / (NUM_BALANCE_TESTS_EACH / 2) - 1

                    stat["action"] = "balance"
                    stat["action_mix"] = test_tilt

                    initial_deposit = harness.pool_create_mix(tilt=0.5, size=1.5)

                    stat["before_oeth_supply"] = harness.oeth.totalSupply()
                    harness.vault_admin.depositToStrategy(
                        harness.strat,
                        list(initial_deposit.keys()),
                        list(initial_deposit.values()),
                        {"from": STRATEGIST},
                    )
                    stat["after_oeth_supply"] = harness.oeth.totalSupply()

                    stat["pre_vault"] = harness.vault_core.totalValue()
                    pb = list(harness.pool_balances().values())
                    stat["pre_pool_0"] = pb[0]
                    stat["pre_pool_1"] = pb[1]

                    harness.tilt_pool(initial_tilt)

                    stat["before_vault"] = harness.vault_core.totalValue()
                    pb = list(harness.pool_balances().values())
                    stat["before_pool_0"] = pb[0]
                    stat["before_pool_1"] = pb[1]

                    harness.tilt_pool(initial_tilt)

                    stat["after_vault"] = harness.vault_core.totalValue()
                    pb = list(harness.pool_balances().values())
                    stat["after_pool_0"] = pb[0]
                    stat["after_pool_1"] = pb[1]

                    balance_stats.append(stat)
            except:
                pass

    pd.DataFrame.from_records(balance_stats).to_csv(workspace + "balance_stats.csv")

    # Test Withdraws
    withdraw_stats = []
    for initial_tilt in [0.0, -0.25, -0.5, 0.25, 0.5]:
        for deposit_x in range(0, NUM_WITHDRAW_TESTS_EACH + 1, 1):
            with TemporaryFork():
                stat = {}

                deposit_mix = deposit_x / NUM_WITHDRAW_TESTS_EACH
                if deposit_mix < 0.1 or deposit_mix > 0.9:
                    continue

                stat["action"] = "withdraw"
                stat["action_mix"] = deposit_mix

                initial_deposit = harness.pool_create_mix(tilt=0.5, size=2)
                harness.vault_admin.depositToStrategy(
                    harness.strat,
                    list(initial_deposit.keys()),
                    list(initial_deposit.values()),
                    {"from": STRATEGIST},
                )

                stat["pre_vault"] = harness.vault_core.totalValue()
                pb = list(harness.pool_balances().values())
                stat["pre_pool_0"] = pb[0]
                stat["pre_pool_1"] = pb[1]

                print("Withdraw Tilt")
                harness.tilt_pool(initial_tilt)

                stat["before_vault"] = harness.vault_core.totalValue()
                pb = list(harness.pool_balances().values())
                stat["before_pool_0"] = pb[0]
                stat["before_pool_1"] = pb[1]

                print("Withdraw Withdraw", deposit_mix)
                withdraw = harness.pool_create_mix(deposit_mix, size=0.3)
                stat["before_oeth_supply"] = harness.oeth.totalSupply()
                harness.vault_admin.withdrawFromStrategy(
                    harness.strat,
                    list(withdraw.keys()),
                    list(withdraw.values()),
                    {"from": STRATEGIST, "allow_revert": True},
                )
                stat["after_oeth_supply"] = harness.oeth.totalSupply()

                stat["after_vault"] = harness.vault_core.totalValue()
                pb = list(harness.pool_balances().values())
                stat["after_pool_0"] = pb[0]
                stat["after_pool_1"] = pb[1]

                withdraw_stats.append(stat)

    pd.DataFrame.from_records(withdraw_stats).to_csv(workspace + "withdraw_stats.csv")

    # Test WithdrawAll

    withdrawall_stats = []
    for initial_tilt in range(0, NUM_WITHDRAWALL_TESTS_EACH + 1, 1):
        with TemporaryFork():
            stat = {}

            initial_tilt = (initial_tilt / NUM_WITHDRAWALL_TESTS_EACH - 0.5) * 4

            stat["action"] = "withdrawall"
            stat["action_mix"] = initial_tilt

            initial_deposit = harness.pool_create_mix(tilt=0.5, size=1.5)
            harness.vault_admin.depositToStrategy(
                harness.strat,
                list(initial_deposit.keys()),
                list(initial_deposit.values()),
                {"from": STRATEGIST},
            )
            #harness.vault_core.rebase({"from":GOVERNOR})

            stat["pre_vault"] = harness.vault_core.totalValue()
            pb = list(harness.pool_balances().values())
            stat["pre_pool_0"] = pb[0]
            stat["pre_pool_1"] = pb[1]

            harness.tilt_pool(initial_tilt)

            stat["before_vault"] = harness.vault_core.totalValue()
            pb = list(harness.pool_balances().values())
            stat["before_pool_0"] = pb[0]
            stat["before_pool_1"] = pb[1]

            stat["before_oeth_supply"] = harness.oeth.totalSupply()

            harness.vault_admin.withdrawAllFromStrategy(
                harness.strat, {"from": STRATEGIST}
            )
            stat["after_oeth_supply"] = harness.oeth.totalSupply()

            stat["after_vault"] = harness.vault_core.totalValue()
            pb = list(harness.pool_balances().values())
            stat["after_pool_0"] = pb[0]
            stat["after_pool_1"] = pb[1]

            withdrawall_stats.append(stat)

    pd.DataFrame.from_records(withdrawall_stats).to_csv(
        workspace + "withdrawall_stats.csv"
    )


def run_report(strategy_name):
    print("Generating report")
    workspace = _getWorkspace(strategy_name)
    harness = _getHarness(strategy_name)

    # deposit_base = _load_data(workspace + "deposit_stats.csv")
    balance_base = _load_data(workspace + "balance_stats.csv")
    # withdraw_base = _load_data(workspace + "withdraw_stats.csv")
    withdrawall_base = _load_data(workspace + "withdrawall_stats.csv")

    sections = []

   # Balance Section
    df = balance_base
    for before_mix, rows in df.groupby(df["before_mix"]):
        plt.plot(rows["action_mix"], rows["after_profit"])
    plt.savefig(workspace + "balance.svg")
    plt.close()
    sections.append(
        '<h2>Balance Check</h2><img src="balance.svg"><p class=note>Flat is good</p>'
    )

    # Deposit Section
    # df = deposit_base
    # plt.title("Deposit profit")
    # plt.axhline(0, c="black", linewidth=0.4)
    # for before_mix, rows in df.groupby(df["before_mix"]):
    #     plt.plot(
    #         rows["action_mix"] * 100,
    #         rows["after_profit"],
    #         label="{:.1f}%".format(100 * float(before_mix)),
    #     )
    # plt.ylim([-1e18, 1e18])
    # plt.xlabel("Deposit Mix")
    # plt.ylabel("Deposit Profit")
    # plt.legend()
    # plt.savefig(workspace + "deposit.svg")
    # plt.close()
    # sections.append('<h2>Deposit</h2><img src="deposit.svg">')

    # Withdraw Section
    # df = withdraw_base
    # df = df[df.before_mix != df.after_mix]
    # plt.title("Withdraw profit")
    # plt.axhline(0, c="black", linewidth=0.4)
    # for before_mix, rows in df.groupby(df["before_mix"]):
    #     plt.plot(
    #         rows["action_mix"] * 100,
    #         rows["after_profit"],
    #         label="{:.1f}%".format(100 * float(before_mix)),
    #     )
    # plt.ylim([-1e18, 1e18])
    # plt.xlabel("Pool Mix")
    # plt.ylabel("Withdraw Profit")
    # plt.legend()
    # plt.savefig(workspace + "withdraw.svg")
    # plt.close()
    # sections.append('<h2>Withdraw</h2><img src="withdraw.svg">')

    # Withdraw All
    df = withdrawall_base
    plt.axhline(0, c="black", linewidth=0.4)
    plt.plot(df["before_mix"], df["after_profit"])
    #plt.ylim([-1e18,1e18])
    plt.xlabel("Pool Mix")
    plt.ylabel("Withdraw All Profit")
    plt.savefig(workspace + "withdrawall.svg")
    plt.close()
    
    sections.append('<h2>Withdraw All</h2><img src="withdrawall.svg">')

    template = """
    <html>
    <head>
        <title>{{STRATEGY}}</title>
        <style>
        body {
            background: rgb(20, 21, 25);
            color: rgb(250 251 251);
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
            text-align: center
        }
        h2 {
            background: rgb(157, 29, 242);
            margin-bottom: 13px;
            padding-bottom: 7px;
            margin-top: 29px;
            padding-top: 4px;
        }
        </style>
    </head>
    <body>
    <h1>{{STRATEGY}} Report</h1>
    <p>{{STRATEGYADDRESS}}</p>
    CONTENTS
    </body>
    </html>
    """

    html = template.replace("CONTENTS", "\n\n".join(sections))
    html = html.replace("{{STRATEGY}}", harness.name)
    html = html.replace("{{STRATEGYADDRESS}}", harness.strat.address)
    filename = workspace + "index.html"
    print(filename)
    with open(filename, "w") as f:
        f.write(html)


# #run_report("BalancerRethEth")

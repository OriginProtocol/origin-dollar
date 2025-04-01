import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import re
from pathlib import Path
from brownie import *
# NOTICE: un-comment the below import depending on the chain in which the test is ran
# from world import *
# from world_base import *
from world_sonic import *


WSTETH_WHALE = "0x176f3dab24a159341c0509bb36b833e7fdd0a132"
WETH_WHALE = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28"
RETH_WHALE = "0x714301eB35fE043FAa547976ce15BcE57BD53144"
STETH_WHALE = "0x2bf3937b8BcccE4B65650F122Bb3f1976B937B2f"

BASE_WETH_WHALE  = "0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7"

# sonic
SONIC_WS_WHALE = "0x6C5E14A212c1C3e4Baf6f871ac9B1a969918c131"
# the WOS contract
SONIC_OS_WHALE = "0x9F0dF7799f6FDAd409300080cfF680f5A23df4b1"

MASTER_SIZE = 60
NUM_DEPOSIT_TESTS_EACH = MASTER_SIZE
NUM_BALANCE_TESTS_EACH = MASTER_SIZE
NUM_WITHDRAW_TESTS_EACH = MASTER_SIZE
NUM_WITHDRAWALL_TESTS_EACH = MASTER_SIZE


class BalancerRethEth:
    def __init__(self):
        strat_address = "0xB262b69d1dB3dc092C73384B8553DA3d00e93682"
        pool_address = "0x1E19CF2D73a72Ef1332C882F20534B6519Be0276"
        self.strat = load_contract("morpho_strat", strat_address)
        self.pool = load_contract("balancer_metastablepool", pool_address)
        self.name = "Balancer Steth-Eth Metastable"
        self.vault_core = oeth_vault_core
        self.vault_admin = oeth_vault_admin
        self.base_size = 2000

        self._balancer_vault = load_contract("balancer_vault", self.pool.getVault())
        self._pool_pid = (
            "0x1e19cf2d73a72ef1332c882f20534b6519be0276000200000000000000000112"
        )
        self._pool_tokens = self.pool_balances().keys()

    def setup(self):
        reth.approve(self._balancer_vault, 1e70, {"from": RETH_WHALE})
        weth.approve(self._balancer_vault, 1e70, {"from": WETH_WHALE})

    def pool_balances(self):
        balances = self._balancer_vault.getPoolTokens(self._pool_pid)[0:2]
        return dict(zip(balances[0], balances[1]))

    def tilt_pool(self, size):
        print("Tilt pool", size)
        amount = abs(size) * self.base_size * int(1e18)
        if size > -0.00001 and size < 0.00001:
            print("skip tilt")
            pass
        elif size > 0:
            self._balancer_vault.swap(
                (self._pool_pid, 0, WETH, RETH, amount, ""),
                (WETH_WHALE, False, WETH_WHALE, False),
                1,
                chain.time() + 100,
                {"from": WETH_WHALE},
            )
        else:
            self._balancer_vault.swap(
                (self._pool_pid, 0, RETH, WETH, amount, ""),
                (RETH_WHALE, False, RETH_WHALE, False),
                1,
                chain.time() + 100,
                {"from": RETH_WHALE},
            )

    def pool_create_mix(self, tilt=0.5, size=1):
        return {
            RETH: 2 + int(size * self.base_size * (int(1e18) - (int(1e18) * tilt))),
            WETH: 2 + int(size * self.base_size * int(1e18) * tilt),
        }
class BalancerCompPoolSfrxEthWstETHrETH:
    def __init__(self):
        strat_address = "0xB262b69d1dB3dc092C73384B8553DA3d00e93682"
        pool_address = "0x42ED016F826165C2e5976fe5bC3df540C5aD0Af7"
        self.strat = load_contract("morpho_strat", strat_address)
        self.pool = load_contract("balancer_metastablepool", pool_address)
        self.name = "Balancer Composable SfrxEthWstETHrETH"
        self.vault_core = oeth_vault_core
        self.vault_admin = oeth_vault_admin
        self.base_size = 2000

        self._balancer_vault = load_contract("balancer_vault", self.pool.getVault())
        self._pool_pid = (
            "0x42ed016f826165c2e5976fe5bc3df540c5ad0af700000000000000000000058b"
        )
        self._pool_tokens = self.pool_balances().keys()

    def setup(self):
        reth.approve(self._balancer_vault, 1e70, {"from": RETH_WHALE})
        wsteth.approve(self._balancer_vault, 1e70, {"from": WSTETH_WHALE})

    def pool_balances(self):
        balances = self._balancer_vault.getPoolTokens(self._pool_pid)
        return dict(zip(balances[0][1:3], balances[1][1:3]))

    def tilt_pool(self, size):
        amount = abs(size) * self.base_size * int(1e18)
        print("Tilt pool", size, amount)
        if size > -0.00001 and size < 0.00001:
            print("skip tilt")
            pass
        elif size > 0:
            self._balancer_vault.swap(
                (self._pool_pid, 0, WSTETH, RETH, amount, ""),
                (WSTETH_WHALE, False, WSTETH_WHALE, False),
                1,
                chain.time() + 100,
                {"from": WSTETH_WHALE},
            )
        else:
            self._balancer_vault.swap(
                (self._pool_pid, 0, RETH, WSTETH, amount, ""),
                (RETH_WHALE, False, RETH_WHALE, False),
                1,
                chain.time() + 100,
                {"from": RETH_WHALE},
            )

    def pool_create_mix(self, tilt=0.5, size=1):
        return {
            RETH: 2 + int(size * self.base_size * (int(1e18) - (int(1e18) * tilt))),
            STETH: 2 + int(size * self.base_size * int(1e18) * tilt),
        }

class CurveSuperOETHbWETH:
    def __init__(self):
        strat_address = "0x31a91336414d3b955e494e7d485a6b06b55fc8fb"
        pool_address = "0x302A94E3C28c290EAF2a4605FC52e11Eb915f378"
        self.strat = load_contract("morpho_strat", strat_address)
        self.pool = load_contract("curve_pool_base", pool_address)
        self.name = "Curve Pool AMO"
        self.vault_core = vault_core
        self.vault_admin = vault_admin
        self.otoken = oethb
        self.base_size = int(500)
        self.STRATEGIST = vault_core.strategistAddr()
        self.amo_base = weth

    def setup(self):
        print(weth.address)
        weth.approve(self.vault_core, 1e70, {"from": BASE_WETH_WHALE})
        weth.approve(self.pool, 1e70, {"from": BASE_WETH_WHALE})
        oethb.approve(self.pool, 1e70, {"from": BASE_WETH_WHALE})


    def pool_balances(self):
        print("⚱︎ pool_balances")
        return {
            weth.address: self.pool.balances(0),
            oethb.address: self.pool.balances(1),
        }

    def tilt_pool(self, size):
        vault_core.mint(weth, 1000*10**18, 0, {"from": BASE_WETH_WHALE})
        amount = abs(size) * self.base_size * int(1e18)
        print("Tilt pool", size, amount)
        if size > -0.00001 and size < 0.00001:
            print("skip tilt")
            pass
        elif size > 0:
            self.pool.exchange(0,1, amount, 0, BASE_WETH_WHALE, {"from": BASE_WETH_WHALE})
        else:
            self.pool.exchange(1,0, amount, 0, BASE_WETH_WHALE, {"from": BASE_WETH_WHALE})

    def pool_create_mix(self, tilt=0.5, size=1):
        print("⚱︎ pool_create_mix")
        mix = {
            weth.address: 2 + int(size * self.base_size * (int(1e18) - (int(1e18) * tilt))),
            oethb.address: 2 + int(size * self.base_size * int(1e18) * tilt),
        }
        return mix

class SwapxOsWS:
    def __init__(self):
        # TODO: the strat address will change once the pool is live
        strat_address = "0xbE19cC5654e30dAF04AD3B5E06213D70F4e882eE"
        pool_address = "0xcfE67b6c7B65c8d038e666b3241a161888B7f2b0"
        self.strat = load_contract("swapx_amo_strat", strat_address)
        self.pool = load_contract("swapx_pool_pair", pool_address)
        self.name = "SwapX Pool AMO"
        self.vault_core = vault_core
        self.vault_admin = vault_admin
        self.otoken = os
        # for check balance tests use 5 million base
        #self.base_size = int(5_000_000)
        # for deposit tests use 500 base
        self.base_size = int(500)
        self.STRATEGIST = vault_core.strategistAddr()
        self.amo_base = ws

    def setup(self):
        ws.approve(self.vault_core, 1e70, {"from": SONIC_WS_WHALE})
        ws.approve(self.pool, 1e70, {"from": SONIC_WS_WHALE})
        os.approve(self.pool, 1e70, {"from": SONIC_WS_WHALE})


    def pool_balances(self):
        print("⚱︎ pool_balances")

        return {
            "ws": self.pool.reserve0(),
            "os": self.pool.reserve1(),
        }

    def tilt_pool(self, size):
        # 10m OS
        vault_core.mint(ws, 10 * 10**24, 0, {"from": SONIC_WS_WHALE})
        amount = abs(size) * self.base_size * int(1e18)
        print("Tilt pool", size, amount)
        if size > -0.00001 and size < 0.00001:
            print("skip tilt")
            pass
        elif size > 0:
            ws.transfer(self.pool.address, amount, {"from": SONIC_WS_WHALE})
            amountOut = self.pool.getAmountOut(amount, ws.address)

            self.pool.swap(0, amountOut, SONIC_WS_WHALE, b'', {"from": SONIC_WS_WHALE});
        else:
            os.transfer(self.pool.address, amount, {"from": SONIC_WS_WHALE})
            amountOut = self.pool.getAmountOut(amount, os.address)

            self.pool.swap(amountOut, 0, SONIC_WS_WHALE, b'', {"from": SONIC_WS_WHALE});

    def pool_create_mix(self, tilt=0.5, size=1):
        print("⚱︎ pool_create_mix")
        mix = {
            ws.address: 2 + int(size * self.base_size * (int(1e18) - (int(1e18) * tilt))),
            os.address: 2 + int(size * self.base_size * int(1e18) * tilt),
        }
        return mix

# --------------


def _getHarness(name):
    print(name)
    if name == "BalancerCompPoolSfrxEthWstETHrETH":
        return BalancerCompPoolSfrxEthWstETHrETH()
    elif name == "BalancerRethEth":
        return BalancerRethEth()
    elif name == "CurveSuperOETHbWETH":
        return CurveSuperOETHbWETH()
    elif name == "SwapxOsWS":
        return SwapxOsWS()
    return


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
    base["after_profit"] = base["after_vault"] - base["before_vault"] + base["before_otoken"] - base['after_otoken'] 
    return base


def main():
    print("Please use: brownie run strategy_report run_complete <STRATEGY_NAME>")
    pass


def run_complete(strategy_name):
    run_simulations_amo(strategy_name)
    run_report(strategy_name)


def run_simulations_amo(strategy_name):
    workspace = _getWorkspace(strategy_name)
    harness = _getHarness(strategy_name)

    # Run setup
    harness.setup()
    try:
        print("⚱︎ withdraw all from strategies.")
        harness.vault_admin.withdrawAllFromStrategies({"from": harness.STRATEGIST})
    except:
        pass


    # Test CheckBalance
    print("Test Check Balance")
    check_balance_stats = []

    for tilt in np.linspace(-1, 1, 41):
        with TemporaryFork():
            stat = {}
            stat["action"] = "checkBalance"
            stat["action_mix"] = tilt

            deposit_amount = harness.base_size * 0.5 * int(1e18)
            ws.transfer(vault_admin, deposit_amount * 2, {"from": SONIC_WS_WHALE})

            print("deposit to strategy")
            harness.vault_admin.depositToStrategy(
                harness.strat,
                [harness.amo_base],
                #[deposit_amount / 5],
                # deposit a smaller amount for an extreme tilt
                [deposit_amount / 50],
                {"from": harness.STRATEGIST},
            )

            pb = list(harness.pool_balances().values())
            stat["pre_pool_0"] = pb[0]
            stat["pre_pool_1"] = pb[1]
            stat["before_pool_0"] = pb[0]
            stat["before_pool_1"] = pb[1]
            stat["pre_vault"] = harness.vault_core.totalValue()
            stat["before_vault"] = harness.vault_core.totalValue()
            stat["before_otoken"] = harness.otoken.totalSupply()
            stat["pool_before_check_balance"] = harness.strat.checkBalance(ws)


            harness.tilt_pool(tilt)

            pb = list(harness.pool_balances().values())
            stat["after_pool_0"] = pb[0]
            stat["after_pool_1"] = pb[1]
            stat["after_vault"] = harness.vault_core.totalValue()
            stat["after_otoken"] = harness.otoken.totalSupply()
            stat["pool_after_check_balance"] = harness.strat.checkBalance(ws)

            check_balance_stats.append(stat)

    pd.DataFrame.from_records(check_balance_stats).to_csv(workspace + "check_balance_stats.csv")

    # # Test Deposits
    # print("# Test Deposits")
    # deposit_stats = []

    # vault_core.mint(ws, harness.base_size * 1e18, 0, {"from": SONIC_WS_WHALE})
    # for initial_tilt in np.linspace(-0.1, 0.32, 41):
    #         with TemporaryFork():
    #             stat = {}

    #             stat["action"] = "deposit"
    #             stat["action_mix"] = initial_tilt

    #             # mint some OS in case vault doesn't have enough WS liquidity
    #             # vault_core.mint(ws, 5 * 10**24, 0, {"from": SONIC_WS_WHALE})

    #             harness.vault_admin.depositToStrategy(
    #                 harness.strat,
    #                 [harness.amo_base],
    #                 [harness.base_size * 0.5],
    #                 {"from": harness.STRATEGIST},
    #             )

    #             stat["pre_vault"] = harness.vault_core.totalValue()
    #             pb = list(harness.pool_balances().values())
    #             stat["pre_pool_0"] = pb[0]
    #             stat["pre_pool_1"] = pb[1]

    #             harness.tilt_pool(initial_tilt)

    #             stat["before_vault"] = harness.vault_core.totalValue()
    #             stat["before_otoken"] = harness.otoken.totalSupply()
    #             pb = list(harness.pool_balances().values())
    #             stat["before_pool_0"] = pb[0]
    #             stat["before_pool_1"] = pb[1]

    #             # deposit = harness.pool_create_mix(deposit_mix, size=1)
    #             harness.vault_admin.depositToStrategy(
    #                 harness.strat,
    #                 [harness.amo_base],
    #                 [harness.base_size * 0.2],
    #                 {"from": harness.STRATEGIST},
    #             )

    #             stat["after_vault"] = harness.vault_core.totalValue()
    #             stat["after_otoken"] = harness.otoken.totalSupply()
    #             pb = list(harness.pool_balances().values())
    #             stat["after_pool_0"] = pb[0]
    #             stat["after_pool_1"] = pb[1]

    #             deposit_stats.append(stat)
    # pd.DataFrame.from_records(deposit_stats).to_csv(workspace + "deposit_stats.csv")
    

    # # Test Withdraws
    # withdraw_stats = []
    # for initial_tilt in np.linspace(-0.7, 0.7, 41):
    #         with TemporaryFork():
    #             stat = {}

    #             stat["action"] = "withdraw"
    #             stat["action_mix"] = initial_tilt
    #             print("w Deposit")
    #             pb = list(harness.pool_balances().values())
    #             stat["pre_pool_0"] = pb[0]
    #             stat["pre_pool_1"] = pb[1]
    #             print(pb[0]/10**18,pb[1]/10**18)

    #             harness.vault_admin.depositToStrategy(
    #                 harness.strat,
    #                 [harness.amo_base],
    #                 [harness.base_size * 1 * 10**18],
    #                 {"from": harness.STRATEGIST},
    #             )

    #             stat["pre_vault"] = harness.vault_core.totalValue()
    #             pb = list(harness.pool_balances().values())
    #             stat["pre_pool_0"] = pb[0]
    #             stat["pre_pool_1"] = pb[1]
    #             print(pb[0]/10**18,pb[1]/10**18)

    #             print("Withdraw Tilt")
    #             harness.tilt_pool(initial_tilt)

    #             stat["before_vault"] = harness.vault_core.totalValue()
    #             stat["before_otoken"] = harness.otoken.totalSupply()
    #             pb = list(harness.pool_balances().values())
    #             stat["before_pool_0"] = pb[0]
    #             stat["before_pool_1"] = pb[1]
    #             print(pb[0]/10**18,pb[1]/10**18)

    #             print("Withdraw Withdraw")
    #             harness.vault_admin.withdrawFromStrategy(
    #                 harness.strat,
    #                 [harness.amo_base],
    #                 [1e18],
    #                 {"from": harness.STRATEGIST, "allow_revert": True},
    #             )

    #             stat["after_vault"] = harness.vault_core.totalValue()
    #             stat["after_otoken"] = harness.otoken.totalSupply()
    #             pb = list(harness.pool_balances().values())
    #             stat["after_pool_0"] = pb[0]
    #             stat["after_pool_1"] = pb[1]

    #             withdraw_stats.append(stat)

    # pd.DataFrame.from_records(withdraw_stats).to_csv(workspace + "withdraw_stats.csv")

    # Test WithdrawAll

    # withdrawall_stats = []
    # for initial_tilt in np.linspace(-1.5, 1.5, 41):
    #     with TemporaryFork():
    #         stat = {}

    #         stat["action"] = "withdrawall"
    #         stat["action_mix"] = initial_tilt

    #         harness.vault_admin.depositToStrategy(
    #             harness.strat,
    #             [harness.amo_base],
    #             [harness.base_size * 2.0],
    #             {"from": harness.STRATEGIST},
    #         )

    #         stat["pre_vault"] = harness.vault_core.totalValue()
    #         pb = list(harness.pool_balances().values())
    #         stat["pre_pool_0"] = pb[0]
    #         stat["pre_pool_1"] = pb[1]

    #         harness.tilt_pool(initial_tilt)

    #         stat["before_vault"] = harness.vault_core.totalValue()
    #         stat["before_otoken"] = harness.otoken.totalSupply()
    #         pb = list(harness.pool_balances().values())
    #         stat["before_pool_0"] = pb[0]
    #         stat["before_pool_1"] = pb[1]

    #         harness.vault_admin.withdrawAllFromStrategy(
    #             harness.strat, {"from": harness.STRATEGIST}
    #         )

    #         stat["after_vault"] = harness.vault_core.totalValue()
    #         stat["after_otoken"] = harness.otoken.totalSupply()
    #         pb = list(harness.pool_balances().values())
    #         stat["after_pool_0"] = pb[0]
    #         stat["after_pool_1"] = pb[1]

    #         withdrawall_stats.append(stat)

    # pd.DataFrame.from_records(withdrawall_stats).to_csv(
    #     workspace + "withdrawall_stats.csv"
    # )




def run_report(strategy_name):
    print("Generating report")
    workspace = _getWorkspace(strategy_name)
    harness = _getHarness(strategy_name)

    # deposit_base = _load_data(workspace + "/deposit_stats.csv")
    # withdraw_base = _load_data(workspace + "/withdraw_stats.csv")
    # withdrawall_base = _load_data(workspace + "/withdrawall_stats.csv")
    checkbalance_base = _load_data(workspace + "/check_balance_stats.csv")

    sections = []
    
    # Check balance Section
    df = checkbalance_base.sort_values('action_mix')
    plt.title("Check balance difference")
    plt.axhline(0, c="black", linewidth=0.4)
    plt.plot(
        df["action_mix"] * 100,
        abs(df["pool_after_check_balance"] -  df["pool_before_check_balance"]),
    )
    #plt.ylim(bottom=0)
    plt.xlabel("Pool tilt [-100 OS heavy, 100 WS heavy]")
    plt.ylabel("Check balance after pool tilt [WEI]")
    plt.legend()
    plt.savefig(workspace + "checkBalance.svg")
    plt.close()
    sections.append('<h2>Check Balance</h2><img src="checkBalance.svg">')

    # # Deposit Section
    # df = deposit_base.sort_values('action_mix')
    # plt.title("Deposit profit")
    # plt.axhline(0, c="black", linewidth=0.4)
    # # for before_mix, rows in df.groupby(df["before_mix"]):
    # plt.plot(
    #     df["action_mix"] * 100,
    #     df["after_profit"],
    # )
    # # plt.ylim([-1e18, 1e18])
    # plt.xlabel("Pool before deposit")
    # plt.ylabel("Deposit Profit")
    # plt.legend()
    # plt.savefig(workspace + "deposit.svg")
    # plt.close()
    # sections.append('<h2>Deposit</h2><img src="deposit.svg">')

    # # # Withdraw Section
    # df = withdraw_base
    # # df = df[df.before_mix != df.after_mix]
    # plt.title("Withdraw profit")
    # plt.axhline(0, c="black", linewidth=0.4)
    # print(df['after_profit'])
    # plt.plot(
    #     df["action_mix"] * 100,
    #     df["after_profit"],
    # )
    # # plt.ylim([-1e18, 1e18])
    # plt.xlabel("Pool Mix")
    # plt.ylabel("Withdraw Profit")
    # plt.legend()
    # plt.savefig(workspace + "withdraw.svg")
    # plt.close()
    # sections.append('<h2>Withdraw</h2><img src="withdraw.svg">')

    # # # Withdraw All
    # df = withdrawall_base
    # plt.axhline(0, c="black", linewidth=0.4)
    # plt.scatter(df["action_mix"]/1.5+0.5, df["after_profit"])
    # plt.scatter(df["before_mix"], df["after_profit"])
    # plt.plot(df["before_mix"], df["after_profit"])
    # # plt.ylim([-1e18,1e18])
    # plt.xlabel("Pool Mix")
    # plt.ylabel("Withdraw All Profit")
    # plt.savefig(workspace + "withdrawall.svg")
    # plt.close()
    # sections.append('<h2>Withdraw All</h2><img src="withdrawall.svg">')
    

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

#run_report("SwapxOsWS")
#run_complete("SwapxOsWS")
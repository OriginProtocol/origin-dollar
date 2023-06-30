import world
import pandas as pd
import brownie
import re

NAME_TO_STRAT = {
    "CONVEX": world.convex_strat,
    "AAVE": world.aave_strat,
    "COMP": world.comp_strat,
    "MORPHO_COMP": world.morpho_comp_strat,
    "MORPHO_AAVE": world.morpho_aave_strat,
    "OUSD_META": world.ousd_meta_strat,
    "LUSD_3POOL": world.lusd_3pool_strat,  # TODO, contract
}

NAME_TO_TOKEN = {
    "DAI": world.dai,
    "USDC": world.usdc,
    "USDT": world.usdt,
}

CORE_STABLECOINS = {
    "DAI": world.dai,
    "USDC": world.usdc,
    "USDT": world.usdt,
}

SNAPSHOT_NAMES = {
    "Aave DAI": ["AAVE", "DAI"],
    "Aave USDC": ["AAVE", "USDC"],
    "Aave USDT": ["AAVE", "USDT"],
    "Compound DAI": ["COMP", "DAI"],
    "Compound USDC": ["COMP", "USDC"],
    "Compound USDT": ["COMP", "USDT"],
    "Morpho Compound DAI": ["MORPHO_COMP", "DAI"],
    "Morpho Compound USDC": ["MORPHO_COMP", "USDC"],
    "Morpho Compound USDT": ["MORPHO_COMP", "USDT"],
    "Morpho Aave DAI": ["MORPHO_AAVE", "DAI"],
    "Morpho Aave USDC": ["MORPHO_AAVE", "USDC"],
    "Morpho Aave USDT": ["MORPHO_AAVE", "USDT"],
    "Convex DAI/USDC/USDT": ["CONVEX", "*"],
    "Convex DAI+USDC+USDT": ["CONVEX", "*"],
    "Convex OUSD/3Crv": ["OUSD_META", "*"],
    "Convex OUSD+3Crv": ["OUSD_META", "*"],
    "Convex LUSD+3Crv": ["LUSD_3POOL", "*"],
}


def load_from_blockchain():
    meta_3pool_dollars = world.ousd_metapool.balances(1) * world.threepool.get_virtual_price() / 1e18
    meta_ousd_dollars = world.ousd_metapool.balances(0)
    meta_stables_mix = meta_3pool_dollars / (meta_ousd_dollars + meta_3pool_dollars)

    base = pd.DataFrame.from_records(
        [
            ["AAVE", "DAI", int(world.aave_strat.checkBalance(world.DAI) / 1e18)],
            ["AAVE", "USDC", int(world.aave_strat.checkBalance(world.USDC) / 1e6)],
            ["AAVE", "USDT", int(world.aave_strat.checkBalance(world.USDT) / 1e6)],
            ["COMP", "DAI", int(world.comp_strat.checkBalance(world.DAI) / 1e18)],
            ["COMP", "USDC", int(world.comp_strat.checkBalance(world.USDC) / 1e6)],
            ["COMP", "USDT", int(world.comp_strat.checkBalance(world.USDT) / 1e6)],
            ["MORPHO_COMP", "DAI", int(world.morpho_comp_strat.checkBalance(world.DAI) / 1e18)],
            ["MORPHO_COMP", "USDC", int(world.morpho_comp_strat.checkBalance(world.USDC) / 1e6)],
            ["MORPHO_COMP", "USDT", int(world.morpho_comp_strat.checkBalance(world.USDT) / 1e6)],
            ["MORPHO_AAVE", "DAI", int(world.morpho_aave_strat.checkBalance(world.DAI) / 1e18)],
            ["MORPHO_AAVE", "USDC", int(world.morpho_aave_strat.checkBalance(world.USDC) / 1e6)],
            ["MORPHO_AAVE", "USDT", int(world.morpho_aave_strat.checkBalance(world.USDT) / 1e6)],
            ["CONVEX", "*", int(world.convex_strat.checkBalance(world.DAI) * 3 / 1e18)],
            ["LUSD_3POOL", "*", int(world.lusd_3pool_strat.checkBalance(world.DAI) * 3 / 1e18)],
            ["OUSD_META", "*", int(world.ousd_meta_strat.checkBalance(world.DAI) * 3 * meta_stables_mix / 1e18)],
            ['VAULT','DAI', int(world.dai.balanceOf(world.vault_core)/ 1e18) ],
            ['VAULT','USDC', int(world.usdc.balanceOf(world.vault_core)/ 1e6)],
            ['VAULT','USDT', int(world.usdt.balanceOf(world.vault_core)/ 1e6)],
        ],
        columns=["strategy", "token", "current_dollars"],
    )
    base["current_allocation"] = base["current_dollars"] / base["current_dollars"].sum()
    return base


def reallocate(from_strat, to_strat, funds):
    """
    Execute and return a transaction reallocating funds from one strat to another
    """
    if isinstance(from_strat, str) and from_strat[0:2] != "0x":
        from_strat = NAME_TO_STRAT[from_strat]
    if isinstance(to_strat, str) and to_strat[0:2] != "0x":
        to_strat = NAME_TO_STRAT[to_strat]
    amounts = []
    coins = []
    for [dollars, coin] in funds:
        amounts.append(int(dollars * 10 ** coin.decimals()))
        coins.append(coin)
    return world.vault_admin.reallocate(from_strat, to_strat, coins, amounts, {"from": world.STRATEGIST})

def from_strat(from_strat, funds):
    """
    Execute and return a transaction reallocating funds from one strat to another
    """
    if isinstance(from_strat, str) and from_strat[0:2] != "0x":
        from_strat = NAME_TO_STRAT[from_strat]
    amounts = []
    coins = []
    for [dollars, coin] in funds:
        amounts.append(int(dollars * 10 ** coin.decimals()))
        coins.append(coin)
    return world.vault_admin.withdrawFromStrategy(from_strat, coins, amounts, {"from": world.STRATEGIST})

def to_strat(to_strat, funds):
    """
    Execute and return a transaction depositing to a strat
    """
    if isinstance(to_strat, str) and to_strat[0:2] != "0x":
        to_strat = NAME_TO_STRAT[to_strat]
    amounts = []
    coins = []
    for [dollars, coin] in funds:
        amounts.append(int(dollars * 10 ** coin.decimals()))
        coins.append(coin)
    return world.vault_admin.depositToStrategy(to_strat, coins, amounts, {"from": world.STRATEGIST})


def allocation_exposure(allocation):
    """
    Shows how exposed we would be to a stablecoin peg loss.

    Consevitivly assumes that:
    - Any Curve pool would go 100% to the peg lost coin
    - DAI would follow a USDC peg loss.

    Reality may not be quite so bad.
    """
    exposure_masks = {
        "DAI": (allocation["token"] == "DAI") | (allocation["token"] == "*"),
        "USDC": (allocation["token"] == "USDC") | (allocation["token"] == "DAI") | (allocation["token"] == "*"),
        "USDT": (allocation["token"] == "USDT") | (allocation["token"] == "*"),
    }
    total = allocation["current_dollars"].sum()
    print("Maximum exposure: ")
    for coin, mask in exposure_masks.items():
        coin_exposure = allocation[mask]["current_dollars"].sum() / total
        print("  {:<6} {:,.2%}".format(coin, coin_exposure))


def lookup_strategy(address):
    for name, contract in NAME_TO_STRAT.items():
        if contract.address.lower() == address.lower():
            return [name, contract]


def show_default_strategies():
    print("Default Strategies:")
    for coin_name, coin in CORE_STABLECOINS.items():
        default_strat_address = world.vault_core.assetDefaultStrategies(coin)
        name, strat = lookup_strategy(default_strat_address)
        raw_funds = strat.checkBalance(coin)
        decimals = coin.decimals()
        funds = int(raw_funds / (10**decimals))
        print("{:>6} defaults to {} with {:,}".format(coin_name, name, funds))


class TemporaryForkWithVaultStats:
    def __init__(self, votes, has_snapshot=True):
        self.votes = votes
        self.has_snapshot = has_snapshot

    def __enter__(self):
        brownie.chain.snapshot()
        before_allocation = with_target_allocations(load_from_blockchain(), self.votes)
        print(pretty_allocations(before_allocation))
        self.before_votes = before_allocation
        self.before_vault_value = world.vault_core.totalValue()
        self.before_total_supply = world.ousd.totalSupply()

    def __exit__(self, *args, **kwargs):
        if self.has_snapshot:
            snapshot = world.vault_value_checker.snapshots(world.STRATEGIST)
            vault_change = world.vault_core.totalValue() - snapshot[0]
            supply_change = world.ousd.totalSupply() - snapshot[1]
        else:
            vault_change = world.vault_core.totalValue() - self.before_vault_value
            supply_change = world.ousd.totalSupply() - self.before_total_supply
        after_allocation = with_target_allocations(load_from_blockchain(), self.before_votes)
        print(pretty_allocations(after_allocation))
        print("Coin deltas to target")
        print(after_allocation.groupby('token')['delta_dollars'].sum().apply("{:,}".format))
        allocation_exposure(after_allocation)
        
        print('Vault Direct Holdings:')
        print("  DAI", world.c18(world.dai.balanceOf(world.vault_core)))
        print("  USDC", world.c6(world.usdc.balanceOf(world.vault_core)))
        print("  USDT", world.c6(world.usdt.balanceOf(world.vault_core)))

        show_default_strategies()
        print("Vault change", world.c18(vault_change))
        print("Supply change", world.c18(supply_change))
        print("Profit change", world.c18(vault_change - supply_change))
        print("")

        brownie.chain.revert()


def with_target_allocations(allocation, votes):
    df = allocation.copy()
    df["target_allocation"] = float(0.0)
    if isinstance(votes, pd.DataFrame):
        df["target_allocation"] = votes["target_allocation"]
    else:
        for line in votes.splitlines():
            m = re.search(r"[ \t]*(.+)[ \t]([0-9.]+)", line)
            if not m:
                continue
            strat_name = m.group(1).strip()
            strat_alloc = float(m.group(2)) / 100.0
            if strat_name in SNAPSHOT_NAMES:
                [internal_name, internal_coin] = SNAPSHOT_NAMES[strat_name]
                mask = (df.strategy == internal_name) & (df.token == internal_coin)
                df.loc[mask, "target_allocation"] += strat_alloc
            elif strat_name == "Existing Allocation":
                pass
                df["target_allocation"] += df["current_allocation"] * strat_alloc
            else:
                raise Exception('Could not look up strategy name "%s"' % strat_name)

    if df["target_allocation"].sum() > 1.02:
        print(df)
        print(df["target_allocation"].sum())
        raise Exception("Target allocations total too high")
    if df["target_allocation"].sum() < 0.98:
        print(df)
        print(df["target_allocation"].sum())
        raise Exception("Target allocations total too low")

    if isinstance(votes, pd.DataFrame):
        df["target_dollars"] = votes["target_dollars"]
    else:
        df["target_dollars"] = (
            df["current_dollars"].sum() * df["target_allocation"] / df["target_allocation"].sum()
        ).astype(int)
    df["delta_dollars"] = df["target_dollars"] - df["current_dollars"]
    return df


def pretty_allocations(allocation, close_enough=255_000):
    df = allocation.copy()
    df["s"] = ""
    df.loc[df["delta_dollars"].abs() < close_enough, "s"] = "✔︎"
    df["current_allocation"] = df["current_allocation"].apply("{:.2%}".format)
    df["target_allocation"] = df["target_allocation"].apply("{:.2%}".format)
    df["current_dollars"] = df["current_dollars"].apply("{:,}".format)
    df["target_dollars"] = df["target_dollars"].apply("{:,}".format)
    df["delta_dollars"] = df["delta_dollars"].apply("{:,}".format)
    return df.sort_values("strategy")


def net_delta(allocation):
    return allocation.groupby("token")["delta_dollars"].sum().to_dict()


def spread_to_coins(total, per_coin, reverse=False, min_move=5000):
    remaining = total
    amounts_to_move = []
    for token in CORE_STABLECOINS.keys():
        amount = per_coin[token]
        if reverse:
            amount = amount * -1
        if amount < min_move:
            continue
        amounts_to_move.append([int(amount // 1000 * 1000), CORE_STABLECOINS[token]])
    return amounts_to_move


def auto_take_snapshot():
    return [
        world.vault_core.rebase({"from": world.STRATEGIST}),
        world.vault_value_checker.takeSnapshot({"from": world.STRATEGIST}),
    ]


def auto_check_snapshot():
    snapshot = world.vault_value_checker.snapshots(world.STRATEGIST)
    print(snapshot)
    vault_change = world.vault_core.totalValue() - snapshot[0]
    supply_change = world.ousd.totalSupply() - snapshot[1]
    profit = vault_change - supply_change

    return [
        world.vault_value_checker.checkDelta(
            profit, # expectedProfit
            500 * int(1e18), # profitVariance
            vault_change, # expectedVaultChange
            250_000 * int(1e18), # vaultChangeVariance
            {"from": world.STRATEGIST},
        )
    ]


def auto_consolidate_stables(allocation, consolidation):
    "Take all stables above target and send to consolidate strat"
    txs = []
    for strat_name in ["AAVE", "COMP", "MORPHO_COMP", "MORPHO_AAVE"]:
        if consolidation == strat_name:
            continue
        haves = net_delta(allocation[allocation["strategy"] == strat_name])
        amounts = spread_to_coins(int(1e60), haves, reverse=True)
        print("auto_consolidate_stables", strat_name, haves, amounts)
        if amounts:
            print("auto_consolidate_stables", strat_name, "->", consolidation, "|", pretty_amounts(amounts))
            txs.append(reallocate(strat_name, consolidation, amounts))
    return txs


def auto_distribute_stables(allocation, consolidation, min_move):
    "Send to stable strats that are missing funds"
    txs = []
    for strat_name in ["AAVE", "COMP", "MORPHO_COMP", "MORPHO_AAVE"]:
        if consolidation == strat_name:
            continue
        needs = net_delta(allocation[allocation["strategy"] == strat_name])
        amounts = spread_to_coins(int(1e60), per_coin=needs, min_move=min_move)
        print("auto")
        print(strat_name)
        print("auto", strat_name, needs)
        print("auto_distribute_stables", strat_name, needs, amounts)
        if amounts:
            print("auto_distribute_stables", consolidation, "->", strat_name, "|", pretty_amounts(amounts))
            txs.append(reallocate(consolidation, strat_name, amounts))
    return txs


def auto_fund_defund_3pools(allocation, consolidation, exchange):
    "VERY INCOMPLETE FOR MANY REASONS."
    txs = []
    # net = net_delta(allocation)
    # # Out
    # # for k, row in allocation[allocation['token']=='*'].iterrows():
    # #         if row['strategy'] == exchange:
    # #             continue
    # #         if row['delta_dollars'] > -5000:
    # #             continue
    # #
    # #         strat_name = row['strategy']
    # #         delta = row['delta_dollars'] * -1
    # #         print(strat_name, delta)

    # # In
    # for k, row in allocation[allocation['token']=='*'].iterrows():
    #     if row['strategy'] == exchange:
    #         continue
    #     if row['delta_dollars'] < 5000:
    #         continue

    #     strat_name = row['strategy']
    #     pool_need = row['delta_dollars']
    #     haves = net_delta(allocation[allocation['strategy']==consolidation])
    #     amounts = spread_to_coins(pool_need, haves, reverse=True)
    #     if amounts:
    #         txs.append(reallocate(consolidation, strat_name, amounts))
    return txs


def auto_exchange_in(allocation, consolidation, exchange):
    "From consolidation to exchange"
    txs = []
    exchange_has = allocation[(allocation.token == "*") & (allocation.strategy == exchange)]["delta_dollars"].sum()
    consolidation_needs = sum([x for x in net_delta(allocation).values() if x > 0])
    exchange_needed = exchange_has + consolidation_needs
    print(">>> auto_exchange_in", exchange_has, consolidation_needs, exchange_needed)
    haves = net_delta(allocation[allocation["strategy"] == consolidation])
    amounts = spread_to_coins(exchange_needed, haves, reverse=True)
    if amounts:
        txs.append(reallocate(consolidation, exchange, amounts))
    return txs


def auto_exchange_out(allocation, consolidation, exchange):
    "From exchange to consolidation"
    txs = []
    net = net_delta(allocation)
    exchange_excess = (
        allocation[(allocation.token == "*") & (allocation.strategy == exchange)]["delta_dollars"].sum() * -1
    )
    print(">>> auto_exchange_out", exchange_excess)
    amounts = spread_to_coins(exchange_excess, net)
    if amounts:
        txs.append(reallocate(exchange, consolidation, amounts))
    return txs


def pretty_amounts(amounts):
    return ", ".join(["{:,} {}".format(x[0], x[1].symbol()) for x in amounts])

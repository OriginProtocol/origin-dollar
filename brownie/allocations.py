import world
import pandas as pd
import brownie
import re

NAME_TO_STRAT = {
    "Convex": world.convex_strat,
    "AAVE": world.aave_strat,
    "COMP": world.comp_strat,
    "MORPHO_COMP": world.morpho_comp_strat,
    "OUSD_META": world.ousd_meta_strat,
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
    "Convex DAI/USDC/USDT": ["CONVEX", "*"],
    "Convex OUSD/3Crv": ["OUSD_META", "*"],
}


def load_from_blockchain():
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
            ["CONVEX", "*", int(world.convex_strat.checkBalance(world.DAI) * 3 / 1e18)],
            ["OUSD_META", "*", int(world.ousd_meta_strat.checkBalance(world.DAI) * 3 / 2 / 1e18)],
        ],
        columns=["strategy", "token", "current_dollars"],
    )
    base["current_allocation"] = base["current_dollars"] / base["current_dollars"].sum()
    return base


def reallocate(from_strat, to_strat, funds):
    """
    Execute and return a transaction reallocating funds from one strat to another
    """
    amounts = []
    coins = []
    for [dollars, coin] in funds:
        amounts.append(int(dollars * 10 ** coin.decimals()))
        coins.append(coin)
    return world.vault_admin.reallocate(from_strat, to_strat, coins, amounts, {"from": world.STRATEGIST})


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

    df["target_dollars"] = (
        df["current_dollars"].sum() * df["target_allocation"] / df["target_allocation"].sum()
    ).astype(int)
    df["delta_dollars"] = df["target_dollars"] - df["current_dollars"]
    return df


def pretty_allocations(allocation, close_enough=50_000):
    df = allocation.copy()
    df["s"] = ""
    df.loc[df["delta_dollars"].abs() < close_enough, "s"] = "✔︎"
    df["current_allocation"] = df["current_allocation"].apply("{:.2%}".format)
    df["target_allocation"] = df["target_allocation"].apply("{:.2%}".format)
    df["current_dollars"] = df["current_dollars"].apply("{:,}".format)
    df["target_dollars"] = df["target_dollars"].apply("{:,}".format)
    df["delta_dollars"] = df["delta_dollars"].apply("{:,}".format)
    return df.sort_values("token")

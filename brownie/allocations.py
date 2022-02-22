import world
import pandas as pd
import brownie

NAME_TO_STRAT = {
    "Convex": world.convex_strat,
    "AAVE": world.aave_strat,
    "COMP": world.comp_strat,
}

NAME_TO_TOKEN = {
    "DAI": world.dai,
    "USDC": world.usdc,
    "USDT": world.usdt,
}


def load_from_blockchain():
    base = pd.DataFrame.from_records(
        [
            ["AAVE", "DAI", int(world.aave_strat.checkBalance(world.DAI) / 1e18)],
            # ['AAVE','USDC', int(world.aave_strat.checkBalance(world.USDC)/1e6)],
            ["AAVE", "USDT", int(world.aave_strat.checkBalance(world.USDT) / 1e6)],
            ["COMP", "DAI", int(world.comp_strat.checkBalance(world.DAI) / 1e18)],
            ["COMP", "USDC", int(world.comp_strat.checkBalance(world.USDC) / 1e6)],
            ["COMP", "USDT", int(world.comp_strat.checkBalance(world.USDT) / 1e6)],
            ["Convex", "*", int(world.convex_strat.checkBalance(world.DAI) * 3 / 1e18)],
        ],
        columns=["strategy", "token", "current_dollars"],
    )
    base["current_allocation"] = base["current_dollars"] / base["current_dollars"].sum()
    return base


def add_voting_results(base, vote_results):
    vote_allocations = pd.DataFrame.from_records(
        vote_results, columns=["strategy", "token", "vote_allocation"]
    )
    vote_allocations["vote_allocation"] /= 100
    allocations = base.merge(
        vote_allocations, how="outer", on=["strategy", "token"]
    ).fillna(0)
    allocations = allocations.sort_values(["token", "strategy"])
    allocations["vote_dollars"] = (
        allocations["vote_allocation"] * allocations["current_dollars"].sum()
    ).astype("int64")
    allocations["vote_change"] = (
        allocations["vote_dollars"] - allocations["current_dollars"]
    )
    return allocations


def add_needed_changes(allocations):
    df = allocations
    MOVE_THRESHOLD = df.current_dollars.sum() * 0.005
    df["remaining_change"] = df[df["vote_change"].abs() > MOVE_THRESHOLD]["vote_change"]
    df["remaining_change"] = (df["remaining_change"].fillna(0) / 100000).astype(
        "int64"
    ) * 100000
    df["actual_change"] = 0
    return df


def plan_moves(allocations):
    possible_strat_moves = [
        ["AAVE", "COMP"],
        ["COMP", "AAVE"],
        ["Convex", "COMP"],
        ["Convex", "AAVE"],
        ["AAVE", "Convex"],
        ["COMP", "Convex"],
    ]
    tokens = ["DAI", "USDC", "USDT"]

    moves = []

    df = allocations
    for strat_from, strat_to in possible_strat_moves:
        for token in tokens:
            token_match = (df["token"] == token) | (df["token"] == "*")
            from_filter = token_match & (df["strategy"] == strat_from)
            to_filter = token_match & (df["strategy"] == strat_to)
            from_row = df.loc[from_filter]
            to_row = df.loc[to_filter]
            from_change = from_row.remaining_change.values[0]
            to_change = to_row.remaining_change.values[0]
            from_strategy = from_row.strategy.values[0]
            to_strategy = to_row.strategy.values[0]

            if from_change < 0 and to_change > 0:
                move_change = min(to_change, -1 * from_change)
                df.loc[from_filter, "remaining_change"] += move_change
                df.loc[to_filter, "remaining_change"] -= move_change
                df.loc[from_filter, "actual_change"] -= move_change
                df.loc[to_filter, "actual_change"] += move_change
                moves.append([from_strategy, to_strategy, token, move_change])

    moves = pd.DataFrame.from_records(moves, columns=["from", "to", "token", "amount"])
    return df, moves


def print_headline(text):
    print("------------")
    print(text)
    print("------------")


def generate_transactions(moves):
    move_txs = []
    notes = []
    with world.TemporaryFork():
        before_total = world.vault_core.totalValue()

        for from_to, inner_moves in moves.groupby(["from", "to"]):
            from_strategy = NAME_TO_STRAT[from_to[0]]
            to_strategy = NAME_TO_STRAT[from_to[1]]
            tokens = [NAME_TO_TOKEN[x] for x in inner_moves["token"]]
            dollars = [x for x in inner_moves["amount"]]
            raw_amounts = [
                10 ** token.decimals() * int(amount)
                for token, amount in zip(tokens, dollars)
            ]
            notes.append(
                "- From %s to %s move %s"
                % (
                    from_to[0],
                    from_to[1],
                    ", ".join(
                        [
                            "%s million %s" % (d / 1000000, t)
                            for t, d in zip(inner_moves["token"], dollars)
                        ]
                    ),
                )
            )

            tx = world.vault_admin.reallocate(
                from_strategy,
                to_strategy,
                tokens,
                raw_amounts,
                {"from": world.strategist},
            )
            move_txs.append(tx)

        after_total = world.vault_core.totalValue()
        vault_loss_raw = before_total - after_total
        vault_loss_dollars = int(vault_loss_raw / 1e18)

        print_headline("After Move")
        after = load_from_blockchain()
        after = after.rename(
            {
                "current_allocation": "percent",
                "current_dollars": "dollars",
            }
        )
        print(
            after.to_string(
                formatters={
                    "percent": "{:,.2%}".format,
                    "dollars": "{:,}".format,
                }
            )
        )
        print("Expected loss from move: ${:,}".format(vault_loss_dollars))
    return move_txs, notes, vault_loss_raw


def wrap_in_loss_prevention(moves, vault_loss_raw):
    max_loss = int(vault_loss_raw) + int(abs(vault_loss_raw) * 0.1) + 100 * 1e18
    new_moves = []
    with world.TemporaryFork():
        new_moves.append(
            world.vault_value_checker.takeSnapshot({"from": world.STRATEGIST})
        )
        new_moves = new_moves + moves
        new_moves.append(
            world.vault_value_checker.checkLoss(max_loss, {"from": world.STRATEGIST})
        )
    print(
        "Expected loss: ${:,}  Allowed loss from move: ${:,}".format(
            int(vault_loss_raw // 1e18), int(max_loss // 1e18)
        )
    )
    return new_moves


def transactions_for_reallocation(votes):
    base = load_from_blockchain()
    allocations = add_needed_changes(add_voting_results(base, votes))
    allocations, moves = plan_moves(allocations)
    print_headline("Current, Voting, and planned allocations")
    print(allocations)
    txs, notes, vault_loss_raw = generate_transactions(moves)
    print_headline("Plan")
    print("Planned strategist moves:")
    print("\n".join(notes))
    txs = wrap_in_loss_prevention(txs, vault_loss_raw)

    return txs


# txs = transactions_for_reallocation([
#                 ["AAVE", "DAI", 0.05],
#                 ["AAVE", "USDC", 0],
#                 ["AAVE", "USDT", 3.38],
#                 ["COMP", "DAI", 4.14],
#                 ["COMP", "USDC", 5.62],
#                 ["COMP", "USDT", 0],
#                 ["Convex", "*", 86.81],
#             ])
# safe_tx = safe.multisend_from_receipts(txs)
# safe.sign_with_frame(safe_tx)
# r = safe.post_transaction(safe_tx)

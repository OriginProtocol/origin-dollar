#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def canonical_batch(path):
    batch = json.loads(Path(path).read_text())
    return {
        "chainId": str(batch["chainId"]),
        "transactions": [
            {
                "to": transaction["to"].lower(),
                "value": str(transaction["value"]),
                "data": transaction["data"].lower(),
            }
            for transaction in batch["transactions"]
        ],
    }


def compare(left, right):
    left_batch = canonical_batch(left)
    right_batch = canonical_batch(right)
    if left_batch != right_batch:
        raise AssertionError(
            "Safe payload mismatch:\n"
            + json.dumps({"left": left_batch, "right": right_batch}, indent=2)
        )


def main():
    parser = argparse.ArgumentParser(
        description="Compare Safe payload semantics across local fork engines"
    )
    parser.add_argument("left")
    parser.add_argument("right")
    args = parser.parse_args()
    compare(args.left, args.right)
    print("Safe payloads match: chainId, to, value and data are identical")


if __name__ == "__main__":
    main()

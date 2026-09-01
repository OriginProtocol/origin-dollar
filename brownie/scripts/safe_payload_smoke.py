import json
import os
from pathlib import Path

from brownie import network, web3


def main():
    if web3.eth.chain_id != 1337:
        raise RuntimeError("Safe payload smoke is restricted to local chainId 1337")
    accounts = web3.eth.accounts
    if not accounts:
        raise RuntimeError("Connected node exposes no unlocked development account")
    tx_hash = web3.eth.send_transaction(
        {
            "from": accounts[0],
            "to": "0x000000000000000000000000000000000000dEaD",
            "value": 123,
            "data": "0x1234",
        }
    )
    transaction = web3.eth.get_transaction(tx_hash)
    payload = {
        "version": "1.0",
        "chainId": str(web3.eth.chain_id),
        "meta": {"engine": network.show_active()},
        "transactions": [
            {
                "to": transaction["to"],
                "value": str(transaction["value"]),
                "data": transaction["input"],
                "gas": transaction["gas"],
            }
        ],
    }
    output = Path(os.environ["PAYLOAD_OUT"])
    output.write_text(json.dumps(payload, indent=2) + "\n")
    print(output)

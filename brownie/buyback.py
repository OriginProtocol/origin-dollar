from brownie import Contract
from contextlib import redirect_stdout, contextmanager
import io

from world import *

BUYBACK_CONTRACT = buyback
OGV_CONTRACT = Contract.from_explorer(OGV)


@contextmanager
def silent_tx():
    """
    Hide std out transaction information printing.

    ETH brownie does not currently have a way to silence transaction details.
    """
    f = io.StringIO()
    with redirect_stdout(f):
        yield


def sim_buyback_ogv(amount):
    """
    Run a simulated buyback, and return how much OGV we get back.
    """
    buyback = BUYBACK_CONTRACT
    ogv = OGV_CONTRACT
    with TemporaryFork():
        before = ogv.balanceOf(REWARDS)
        with silent_tx():
            buyback.distributeAndSwap(amount, 1, {"from": STRATEGIST})
        after = ogv.balanceOf(REWARDS)
        return after - before


def build_buyback_tx(max_dollars=5000, max_slippage=2.0):
    """
    Build a buyback transaction and print a varity of information about it.

    :param float max_dollars:
      How much OUSD to use for the buyback. Will use balance if balance is smaller
    :param float max_slippage:
      Percentage of slippage from current prices to allow.
    """
    buyback = BUYBACK_CONTRACT
    treasuryBps = BUYBACK_CONTRACT.treasuryBps()
    ousd_for_treasury = max_dollars * treasuryBps / 10**4
    ousd_to_swap = max_dollars - ousd_for_treasury



    # Calculate buyback amount
    ousd_available = ousd.balanceOf(buyback)
    buyback_amount = min(ousd_available, int(max_dollars * 10**18))

    # Calculate returned OGV
    no_slippage_ogv = sim_buyback_ogv(10**18) * buyback_amount / 10**18
    expected_slippage_ogv = sim_buyback_ogv(buyback_amount)
    min_slippage_ogv = no_slippage_ogv * (1.0 - (max_slippage / 100))

    # Display buyback amounts
    print("OUSD available on contract:   {}".format(c18(ousd_available)))
    print("OUSD to use for transaction:  {}".format(c18(buyback_amount)))
    print("OUSD send to treasury:        {}".format(c18(ousd_for_treasury * 10**18)))
    print("OUSD to swap:                 {}".format(c18(ousd_to_swap * 10**18)))
    print("----")

    x = no_slippage_ogv
    slippage = 1.0 - x / no_slippage_ogv
    print("No slippage {} OGV ({:.2f}% slippage)".format(c18(x), slippage * 100))

    x = expected_slippage_ogv
    slippage = 1.0 - x / no_slippage_ogv
    print("Expected    {} OGV ({:.2f}% slippage)".format(c18(x), slippage * 100))

    x = min_slippage_ogv
    slippage = 1.0 - x / no_slippage_ogv
    print("Minimum     {} OGV ({:.2f}% slippage)".format(c18(x), slippage * 100))

    if expected_slippage_ogv < min_slippage_ogv:
        raise Exception(
            "Minimum slippage less expected slippage. Transaction would fail."
        )

    # Display transaction data
    with TemporaryFork():
        with silent_tx():
            tx = buyback.distributeAndSwap(buyback_amount, min_slippage_ogv, {"from": STRATEGIST})
    print("")
    print("To: {}".format(tx.receiver))
    print("Data: {}".format(tx.input))
    print(tx.error())
    return tx

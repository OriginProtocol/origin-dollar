from world import *

from buyback import *


def main():
    with TemporaryFork():

        bal = oeth.balanceOf(STRATEGIST)
        if bal > 0:
            # Transfer some OETH to the Buyback contract
            oeth.transfer(OETH_BUYBACK, bal, std)

        ousd_amount = ousd.balanceOf(OUSD_BUYBACK)
        build_buyback_tx(OUSD, ousd_amount / 2)

        oeth_amount = oeth.balanceOf(OETH_BUYBACK)
        build_buyback_tx(OETH, oeth_amount / 2)
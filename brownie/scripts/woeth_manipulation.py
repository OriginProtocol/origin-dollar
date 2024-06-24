from world import *

OETH_WHALE="0xa4C637e0F704745D182e4D38cAb7E7485321d059"
whl = {'from': OETH_WHALE }

woeth.convertToAssets(1e18) / 1e18
oeth.transfer(woeth.address, 10_000 * 1e18, whl)
woeth.convertToAssets(1e18) / 1e18

oeth.approve(woeth.address, 1e50, whl)
woeth.deposit(5_000 * 1e18, OETH_WHALE, whl)
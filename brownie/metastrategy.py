from world import *

me = ORIGINTEAM
some_gas_price = 100
OPTS = {'from': me, "gas_price": some_gas_price}

THREEPOOL_BAGS = '0xceaf7747579696a2f0bb206a14210e3c9e6fb269'
OUSD_BAGS = '0x8e02247d3ee0e6153495c971ffd45aa131f4d7cb'
OUSD_BAGS_2 = '0xc055de577ce2039e6d35621e3a885df9bb304ab9'
USDT_BAGS = '0x5754284f345afc66a98fbb0a0afe71e0f007b949'
CURVE_FACTORY = '0xB9fC157394Af804a3578134A6585C0dc9cc990d4'

TOTAL_AMOUNT = int(11e6) * int(1e18)

threepool_lp = load_contract('threepool_lp', THREEPOOL_LP)
ousd_metapool = load_contract('ousd_metapool', OUSD_METAPOOL)
threepool_swap = load_contract('threepool_swap', THREEPOOL)
curve_factory = load_contract('curve_factory', CURVE_FACTORY)

# 1. Acquire 3pool, ousd and usdt
threepool_lp.transfer(me, TOTAL_AMOUNT, {'from': THREEPOOL_BAGS})
ousd.transfer(me, 6*1e6*1e18, {'from': OUSD_BAGS})
usdt.transfer(me, 50*1e6*1e6, {'from': USDT_BAGS})
ousd.transfer(me, 5*1e6*1e18, {'from': OUSD_BAGS_2})

# approve ousd and 3poolLp to be used by ousd_metapool
threepool_lp.approve(ousd_metapool, int(1e50), OPTS)
ousd.approve(ousd_metapool, int(1e50), OPTS)

# set ousd_metastrategy as default strategies for USDT in a governance proposal
tx = vault_admin.setAssetDefaultStrategy(usdt.address, META_STRATEGY, {'from': GOVERNOR})
tx.sig_string = 'setAssetDefaultStrategy(address,address)'
create_gov_proposal("Set meta strategy as default strategy", [tx])
# execute latest proposal
sim_governor_execute(governor.proposalCount())

# approve vault to move USDT
usdt.approve(vault_core.address, int(0), OPTS)
usdt.approve(vault_core.address, int(1e50), OPTS)

# mint OUSD using USDT. Amount denominated in dollar value
# also force call allocate so that funds get deposited to metastrategy
def mint(amount):
	vault_core.mint(usdt.address, amount * 1e6, 0, OPTS)
	vault_core.allocate(OPTS)
	vault_core.rebase(OPTS)

# redeem OUSD. Amount denominated in dollar value
def redeem(amount):
	vault_core.redeem(amount*1e18, amount*1e18*0.95, OPTS)
	vault_core.rebase(OPTS)

def withdrawAllFromMeta():
	vault_admin.withdrawAllFromStrategy(META_STRATEGY, {'from': STRATEGIST})
	vault_core.rebase(OPTS)

# withdraw specific amount of USDT. Amount denominated in dollar value
# Notice: this functionality on vault might not make it to production
def withdrawFromMeta(usdtAmount):
	meta_strat.withdraw(VAULT_PROXY_ADDRESS, '0xdAC17F958D2ee523a2206206994597C13D831ec7', usdtAmount * 1e6, {'from': VAULT_PROXY_ADDRESS})
	vault_core.rebase(OPTS)

# swap 10 mio CRV for OUSD to tilt metapool to be heavier in OUSD
def tiltMetapoolToOUSD():
	ousd_metapool.exchange(1,0, 10*1e6*1e18, 0, OPTS)

# swap 10 mio OUSD for 3CRV to tilt metapool to be heavier in 3CRV
def tiltMetapoolTo3CRV():
	ousd_metapool.exchange(0,1, 10*1e6*1e18, 0, OPTS)


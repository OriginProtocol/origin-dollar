from world import *
import math

me = ORIGINTEAM
some_gas_price = 100
OPTS = {'from': me, "gas_price": some_gas_price}

THREEPOOL_BAGS = '0xceaf7747579696a2f0bb206a14210e3c9e6fb269'
OUSD_BAGS = '0x8e02247d3ee0e6153495c971ffd45aa131f4d7cb'
OUSD_BAGS_2 = '0xc055de577ce2039e6d35621e3a885df9bb304ab9'
USDT_BAGS = '0x5754284f345afc66a98fbb0a0afe71e0f007b949'
USDC_BAGS = '0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf'
CURVE_FACTORY = '0xB9fC157394Af804a3578134A6585C0dc9cc990d4'

threepool_lp = load_contract('threepool_lp', THREEPOOL_LP)
ousd_metapool = load_contract('ousd_metapool', OUSD_METAPOOL)
threepool_swap = load_contract('threepool_swap', THREEPOOL)
curve_factory = load_contract('curve_factory', CURVE_FACTORY)

# 1. Acquire 3pool, ousd and usdt
threepool_lp.transfer(me, threepool_lp.balanceOf(THREEPOOL_BAGS), {'from': THREEPOOL_BAGS})
ousd.transfer(me, ousd.balanceOf(OUSD_BAGS), {'from': OUSD_BAGS})
usdt.transfer(me, usdt.balanceOf(USDT_BAGS), {'from': USDT_BAGS})
ousd.transfer(me, ousd.balanceOf(OUSD_BAGS_2), {'from': OUSD_BAGS_2})
usdc.transfer(me, usdc.balanceOf(USDC_BAGS), {'from': USDC_BAGS})

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

print('\033[93m' + "Operational funds:")
print("-------------------" + '\033[0m')
print("'me' account has: " + c24(ousd.balanceOf(me)) + "m OUSD")
print("'me' account has: " + c24(threepool_lp.balanceOf(me)) + "m 3CRV")
print("'me' account has: " + c12(usdc.balanceOf(me)) + "m USDC")
print("'me' account has: " + c12(usdt.balanceOf(me)) + "m USDT")

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

#withdraw all the funds from Metastrategy
def withdrawAllFromMeta():
	vault_admin.withdrawAllFromStrategy(META_STRATEGY, {'from': STRATEGIST})
	vault_core.rebase(OPTS)

# withdraw specific amount of USDT. Amount denominated in dollar value
# Notice: this functionality on vault might not make it to production
def withdrawFromMeta(usdtAmount):
	meta_strat.withdraw(VAULT_PROXY_ADDRESS, '0xdAC17F958D2ee523a2206206994597C13D831ec7', usdtAmount * 1e6, {'from': VAULT_PROXY_ADDRESS})
	vault_core.rebase(OPTS)

# swap 10 mio CRV for OUSD to tilt metapool to be heavier in OUSD
def tiltMetapoolToOUSD(_amount=10*1e6*1e18):
	return ousd_metapool.exchange(1,0, _amount, 0, OPTS)

# swap 10 mio OUSD for 3CRV to tilt metapool to be heavier in 3CRV
def tiltMetapoolTo3CRV(_amount=10*1e6*1e18):
	return ousd_metapool.exchange(0,1, _amount, 0, OPTS)

# show what direction metapool is tilted to and how much total supply is there
def show_metapool_balances():
    print("  Total: " + c18(ousd_metapool.totalSupply()))
    print("----------------------------------------")
    print(c18(ousd_metapool.balances(0)) + ' OUSD   ', end='')
    print(c18(ousd_metapool.balances(1)) + ' 3CRV  ')
    print("----------------------------------------")


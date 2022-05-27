from world import *
import math

me = ORIGINTEAM
some_gas_price = 100
OPTS = {'from': me, "gas_price": some_gas_price}

RANDOM_ACCOUNT = '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B'
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
ousd.transfer(RANDOM_ACCOUNT, 10000*1e18, OPTS)
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
def mint(amount, asset=usdt):
    vault_core.mint(asset.address, amount * math.pow(10, asset.decimals()), 0, OPTS)
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

# show what direction metapool is tilted to and how much total supply is there
def show_metapool_balances():
    print("---------- Metapool balances -----------")
    print("  Total: " + c18(ousd_metapool.totalSupply()))
    print(c18(ousd_metapool.balances(0)) + ' OUSD   ', end='')
    print(c18(ousd_metapool.balances(1)) + ' 3CRV  ', end='')
    print(c18(ousd_metapool.balances(1)-ousd_metapool.balances(0)) + ' Diff  ')
    print("----------------------------------------")

# swap 10 mio CRV for OUSD to tilt metapool to be heavier in OUSD
def tiltMetapoolToOUSD(_amount=10*1e6*1e18):
    return ousd_metapool.exchange(0,1, _amount, 0, OPTS)

# swap 10 mio OUSD for 3CRV to tilt metapool to be heavier in 3CRV
def tiltMetapoolTo3CRV(_amount=10*1e6*1e18):
    return ousd_metapool.exchange(1,0, _amount, 0, OPTS)

# balance the metapool so that 3CRV and OUSD amounts are close together
def balance_metapool():
    ousd = ousd_metapool.balances(0)
    crv3 = ousd_metapool.balances(1)

    if (ousd > crv3):
        tiltMetapoolTo3CRV((ousd-crv3)/2)
    else:
        tiltMetapoolToOUSD((crv3-ousd)/2)

#observe metapool balance changes and virtual price
class MetapoolBalances:
    def __init__(self, txOptions):
        self.txOptions=txOptions

    def __enter__(self):
        self.virtual_price = ousd_metapool.get_virtual_price()
        self.ousd_balance = ousd_metapool.balances(0)
        self.crv3_balance = ousd_metapool.balances(1)
        self.tilt = self.ousd_balance - self.crv3_balance
        return self

    def __exit__(self, *args, **kwargs):
        virtual_price = ousd_metapool.get_virtual_price()
        ousd_balance = ousd_metapool.balances(0)
        crv3_balance = ousd_metapool.balances(1)
        tilt = ousd_balance- crv3_balance

        print("-------- OUSD Metapool changes ---------")
        print("                " + leading_whitespace("Before") + " " + leading_whitespace("After") + " " + leading_whitespace("Difference"))
        print("OUSD:           " + c18(self.ousd_balance) + " " + c18(ousd_balance) + " " + c18(ousd_balance - self.ousd_balance))
        print("3CRV:           " + c18(self.crv3_balance) + " " + c18(crv3_balance) + " " + c18(crv3_balance - self.crv3_balance))
        print("Tilt:           " + c18(self.tilt) + " " + c18(tilt) + " " + c18(tilt-self.tilt))
        print("Virtual price:  " + c6(self.virtual_price) + " " + c6(virtual_price) + " " + c6(virtual_price - self.virtual_price))
        print("----------------------------------------")

#observe 3crv balance changes and virtual price
class Crv3Balances:
    def __init__(self, txOptions):
        self.txOptions=txOptions

    def __enter__(self):
        self.virtual_price = threepool_swap.get_virtual_price()
        self.dai_balance = threepool_swap.balances(0)
        self.usdc_balance = threepool_swap.balances(1)
        self.usdt_balance = threepool_swap.balances(2)
        self.total = self.dai_balance + self.usdc_balance*1e12 + self.usdt_balance*1e12
        return self

    def __exit__(self, *args, **kwargs):
        virtual_price = threepool_swap.get_virtual_price()
        dai_balance = threepool_swap.balances(0)
        usdc_balance = threepool_swap.balances(1)
        usdt_balance = threepool_swap.balances(2)
        total = dai_balance + usdc_balance*1e12 + usdt_balance*1e12

        print("---------- 3CRV pool changes -----------")
        print("                " + leading_whitespace("Before") + " " + leading_whitespace("After") + " " + leading_whitespace("Difference"))
        print("DAI:            " + c18(self.dai_balance) + " " + c18(dai_balance) + " " + c18(dai_balance - self.dai_balance))
        print("USDC:           " + c6(self.usdc_balance) + " " + c6(usdc_balance) + " " + c6(usdc_balance - self.usdc_balance))
        print("USDT:           " + c6(self.usdt_balance) + " " + c6(usdt_balance) + " " + c6(usdt_balance - self.usdt_balance))
        print("Total:          " + c18(self.total) + " " + c18(total) + " " + c18(total - self.total))
        print("Virtual price:  " + c6(self.virtual_price) + " " + c6(virtual_price) + " " + c6(virtual_price - self.virtual_price))
        print("----------------------------------------")

# observe how OUSD balance changes for a random account
class AccountOUSDBalance:
    def __init__(self, txOptions):
        self.txOptions=txOptions

    def __enter__(self):
        self.ousdBalance = ousd.balanceOf(RANDOM_ACCOUNT, OPTS)
        return self

    def __exit__(self, *args, **kwargs):
        ousdBalance = ousd.balanceOf(RANDOM_ACCOUNT, OPTS)

        print("--- Random account OUSD balance change ---")
        print("                      " + leading_whitespace("Before") + " " + leading_whitespace("After") + " " + leading_whitespace("Difference"))
        print("OUSD balance :   " + c18(self.ousdBalance) + " " + c18(ousdBalance) + " " + c18(ousdBalance - self.ousdBalance))
        print("------------------------------------------")


class ObserveMeBalances:
    def __init__(self, txOptions):
        self.txOptions=txOptions

    def __enter__(self):
        self.ousd_balance=ousd.balanceOf(me, OPTS)
        self.usdt_balance=usdt.balanceOf(me, OPTS)
        self.usdc_balance=usdc.balanceOf(me, OPTS)
        self.dai_balance=dai.balanceOf(me, OPTS)
        self.crv3_balance=threepool_lp.balanceOf(me, OPTS)
        self.crv3_price=threepool_swap.get_virtual_price(OPTS)
        self.crv3_dollar_value = self.crv3_price * self.crv3_balance / 1e18
        self.total=self.ousd_balance+self.usdt_balance*1e12+self.usdc_balance*1e12+self.dai_balance+self.crv3_dollar_value
        return self

    def __exit__(self, *args, **kwargs):
        ousd_balance=ousd.balanceOf(me, OPTS)
        usdt_balance=usdt.balanceOf(me, OPTS)
        usdc_balance=usdc.balanceOf(me, OPTS)
        dai_balance=dai.balanceOf(me, OPTS)
        crv3_balance=threepool_lp.balanceOf(me, OPTS)
        crv3_price=threepool_swap.get_virtual_price(OPTS)
        crv3_dollar_value = crv3_price * crv3_balance / 1e18
        total=ousd_balance+usdt_balance*1e12+usdc_balance*1e12+dai_balance+crv3_dollar_value

        print("----------- Me account changes ---------")
        print("             " + leading_whitespace("Before") + " " + leading_whitespace("After") + " " + leading_whitespace("Difference"))
        print("OUSD:        " + c18(self.ousd_balance) + " " + c18(ousd_balance) + " " + c18(ousd_balance - self.ousd_balance))
        print("USDT:        " + c6(self.usdt_balance) + " " + c6(usdt_balance) + " " + c6(usdt_balance - self.usdt_balance))
        print("USDC:        " + c6(self.usdc_balance) + " " + c6(usdc_balance) + " " + c6(usdc_balance-self.usdc_balance))
        print("DAI:         " + c18(self.dai_balance) + " " + c18(dai_balance) + " " + c18(dai_balance - self.dai_balance))
        print("3CRV(token): " + c18(self.crv3_balance) + " " + c18(crv3_balance) + " " + c18(crv3_balance - self.crv3_balance))
        print("3CRV($value): " + c18(self.crv3_dollar_value) + " " + c18(crv3_dollar_value) + " " + c18(crv3_dollar_value - self.crv3_dollar_value))
        print("Total:       " + c18(self.total) + " " + c18(total) + " " + c18(total - self.total))
        print("----------------------------------------")

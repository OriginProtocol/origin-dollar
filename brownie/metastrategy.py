from world import *
import world
import math


me = ORIGINTEAM
some_gas_price = 100
OPTS = {'from': me, "gas_price": some_gas_price}

RANDOM_ACCOUNT = '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B'
THREEPOOL_BAGS = '0xceaf7747579696a2f0bb206a14210e3c9e6fb269'
THREEPOOL_BAGS_2 = '0xbfcf63294ad7105dea65aa58f8ae5be2d9d0952a'
THREEPOOL_BAGS_3 = '0xaa5a67c256e27a5d80712c51971408db3370927d'
OUSD_BAGS = '0x8e02247d3ee0e6153495c971ffd45aa131f4d7cb'
OUSD_BAGS_2 = '0xc055de577ce2039e6d35621e3a885df9bb304ab9'
USDT_BAGS = '0x5754284f345afc66a98fbb0a0afe71e0f007b949'
USDT_BAGS_2 = '0x5041ed759dd4afc3a72b8192c143f72f4724081a'
USDC_BAGS = '0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf'
USDC_BAGS_2 = '0x0a59649758aa4d66e25f08dd01271e891fe52199'
FRAX_BAGS = '0xdcef968d416a41cdac0ed8702fac8128a64241a2'
BUSD_BAGS = '0xf977814e90da44bfa03b6295a0616a897441acec' # Binance
DAI_BAGS = '0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf' #polygon bridge
DAI_BAGS_2 = '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643' #this is compound cDai. Don't touch this!
CURVE_FACTORY = '0xB9fC157394Af804a3578134A6585C0dc9cc990d4'
OUSD_META_STRATEGY = '0x89Eb88fEdc50FC77ae8a18aAD1cA0ac27f777a90'
USDT_DEFAULT_META_STRATEGY = OUSD_META_STRATEGY

threepool_lp = load_contract('threepool_lp', THREEPOOL_LP)
ousd_metapool = load_contract('ousd_metapool', OUSD_METAPOOL)
busd_metapool = load_contract('ousd_metapool', BUSD_METAPOOL)
threepool_swap = load_contract('threepool_swap', THREEPOOL)
curve_factory = load_contract('curve_factory', CURVE_FACTORY)

# 1. Acquire 3pool, ousd and usdt
threepool_lp.transfer(me, threepool_lp.balanceOf(THREEPOOL_BAGS), {'from': THREEPOOL_BAGS})
threepool_lp.transfer(me, threepool_lp.balanceOf(THREEPOOL_BAGS_2), {'from': THREEPOOL_BAGS_2})
threepool_lp.transfer(me, threepool_lp.balanceOf(THREEPOOL_BAGS_3), {'from': THREEPOOL_BAGS_3})
ousd.transfer(me, ousd.balanceOf(OUSD_BAGS), {'from': OUSD_BAGS})
usdt.transfer(me, usdt.balanceOf(USDT_BAGS), {'from': USDT_BAGS})
usdt.transfer(me, usdt.balanceOf(USDT_BAGS_2), {'from': USDT_BAGS_2})
ousd.transfer(me, ousd.balanceOf(OUSD_BAGS_2), {'from': OUSD_BAGS_2})
ousd.transfer(RANDOM_ACCOUNT, 10000*1e18, OPTS)
usdc.transfer(me, usdc.balanceOf(USDC_BAGS), {'from': USDC_BAGS})
usdc.transfer(me, usdc.balanceOf(USDC_BAGS_2), {'from': USDC_BAGS_2})
dai.transfer(me, dai.balanceOf(DAI_BAGS), {'from': DAI_BAGS})
frax.transfer(me, frax.balanceOf(FRAX_BAGS), {'from': FRAX_BAGS})
busd.transfer(me, busd.balanceOf(BUSD_BAGS), {'from': BUSD_BAGS})
meta_strat = load_contract('convex_strat', OUSD_META_STRATEGY)

# approve ousd and 3poolLp to be used by ousd_metapool
threepool_lp.approve(ousd_metapool, int(0), OPTS)
threepool_lp.approve(ousd_metapool, int(1e50), OPTS)
threepool_lp.approve(busd_metapool, int(0), OPTS)
threepool_lp.approve(busd_metapool, int(1e50), OPTS)
ousd.approve(ousd_metapool, int(0), OPTS)
ousd.approve(ousd_metapool, int(1e50), OPTS)
busd.approve(busd_metapool, int(0), OPTS)
busd.approve(busd_metapool, int(1e50), OPTS)

# set metastrategy as default strategies for USDT in a governance proposal
tx = vault_admin.setAssetDefaultStrategy(usdt.address, USDT_DEFAULT_META_STRATEGY, {'from': GOVERNOR})

# approve vault to move USDT
usdt.approve(vault_core.address, int(0), OPTS)
usdt.approve(vault_core.address, int(1e50), OPTS)
print('\033[93m' + "Operational funds:")
print("-------------------" + '\033[0m')
print("'me' account has: " + c24(ousd.balanceOf(me)) + "m OUSD")
print("'me' account has: " + c24(threepool_lp.balanceOf(me)) + "m 3CRV")
print("'me' account has: " + c12(usdc.balanceOf(me)) + "m USDC")
print("'me' account has: " + c12(usdt.balanceOf(me)) + "m USDT")
print("'me' account has: " + c24(frax.balanceOf(me)) + "m FRAX")

def show_vault_holdings():
    total = vault_core.totalValue()
    world.show_vault_holdings()
    print("-------- Configured Meta Strategy Vault Holdings -----------")
    print("Meta strategy coin:", end='')
    convex_meta_total = meta_strat.checkBalance(DAI) + meta_strat.checkBalance(USDC) * 1e12 + meta_strat.checkBalance(USDT) * 1e12
    convex_meta_pct =  float(convex_meta_total) / float(total) * 100
    print(c18(convex_meta_total) + ' ({:0.2f}%)'.format(convex_meta_pct))
    # TODO: uncomment once if becomes available
    #print("Net OUSD minted for strategy:", end='')
    #print(c18(vault_core.netOusdMintedForStrategy()) + ' OUSD')
    print("----------------------------------------")

# mint OUSD using USDT. Amount denominated in dollar value
# also force call allocate so that funds get deposited to metastrategy
def mint(amount, asset=usdt):
    vault_core.mint(asset.address, amount * math.pow(10, asset.decimals()), 0, OPTS)
    vault_core.allocate(OPTS)
    vault_core.rebase(OPTS)

# reallocate funds from one strategy to another
def reallocate(from_strat, to_strat, asset, amount):
    vault_admin.reallocate(from_strat, to_strat, [asset], [amount * math.pow(10, asset.decimals())], {'from': GOVERNOR})

# redeem OUSD. Amount denominated in dollar value
def redeem(amount):
    vault_core.redeem(amount*1e18, amount*1e18*0.95, OPTS)
    vault_core.rebase(OPTS)

#withdraw all the funds from any Metastrategy
def withdrawAllFromMeta(strategy):
    vault_admin.withdrawAllFromStrategy(strategy, {'from': STRATEGIST})
    vault_core.rebase(OPTS)

# withdraw specific amount of USDT. Amount denominated in dollar value
# Notice: this functionality on vault might not make it to production
def withdrawFromMeta(usdtAmount, strategy):
    strategy.withdraw(VAULT_PROXY_ADDRESS, USDT, usdtAmount * 1e6, {'from': VAULT_PROXY_ADDRESS})
    vault_core.rebase(OPTS)

# show what direction metapool is tilted to and how much total supply is there
def show_metapool_balances(metapool):
    mainCoin = metapool.coins(0)
    mainCoinName=get_erc20_name(mainCoin)

    print("---------- " + mainCoinName + " Metapool balances -----------")
    print("  Total: " + c18(metapool.totalSupply()))
    print(c18(metapool.balances(0)) + ' ' + mainCoinName + '   ', end='')
    print(c18(metapool.balances(1)) + ' 3CRV  ', end='')
    print(c18(metapool.balances(1)-metapool.balances(0)) + ' Diff  ')
    print("----------------------------------------")

# swap 10 mio CRV for mainCoin to tilt metapool to be heavier in mainCoin
def tiltMetapoolToMainCoin(metapool, _amount=10*1e6*1e18):
    return metapool.exchange(0,1, _amount, 0, OPTS)

# swap 10 mio mainCoin for 3CRV to tilt metapool to be heavier in 3CRV
def tiltMetapoolTo3CRV(metapool, _amount=10*1e6*1e18):
    return metapool.exchange(1,0, _amount, 0, OPTS)

# balance the metapool so that 3CRV and MainCoin amounts are close together
def balance_metapool(metapool):
    coin = metapool.balances(0)
    crv3 = metapool.balances(1)

    if (coin > crv3):
        tiltMetapoolTo3CRV(metapool, (coin-crv3)/2)
    else:
        tiltMetapoolToMainCoin(metapool, (crv3-coin)/2)

# set an address that can mint OUSD without providing collateral
def set_no_collateral_minter(address):
    tx = vault_admin.setOusdMetaStrategy(address, {'from': GOVERNOR})
    tx.sig_string = 'setOusdMetaStrategy(address)'
    create_gov_proposal("Set uncollateralized minter", [tx])
    # execute latest proposal
    sim_governor_execute(governor.proposalCount())

#observe metapool balance changes and virtual price
class MetapoolBalances:
    def __init__(self, txOptions, metapool):
        self.txOptions=txOptions
        self.metapool=metapool
        self.mainCoinName=get_erc20_name(self.metapool.coins(0))

    def __enter__(self):
        self.virtual_price = self.metapool.get_virtual_price()
        self.main_coin_balance = self.metapool.balances(0)
        self.crv3_balance = self.metapool.balances(1)
        self.tilt = self.main_coin_balance - self.crv3_balance
        return self

    def __exit__(self, *args, **kwargs):
        virtual_price = self.metapool.get_virtual_price()
        main_coin_balance = self.metapool.balances(0)
        crv3_balance = self.metapool.balances(1)
        tilt = main_coin_balance- crv3_balance

        print("-------- " + self.mainCoinName + " Metapool changes ---------")
        print("                    " + leading_whitespace("Before") + " " + leading_whitespace("After") + " " + leading_whitespace("Difference"))
        print((self.mainCoinName + ":").ljust(20) + c18(self.main_coin_balance) + " " + c18(main_coin_balance) + " " + c18(main_coin_balance - self.main_coin_balance))
        print("3CRV:               " + c18(self.crv3_balance) + " " + c18(crv3_balance) + " " + c18(crv3_balance - self.crv3_balance))
        print("Tilt:               " + c18(self.tilt) + " " + c18(tilt) + " " + c18(tilt-self.tilt))
        print("Virtual price:      " + c6(self.virtual_price) + " " + c6(virtual_price) + " " + c6(virtual_price - self.virtual_price))
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

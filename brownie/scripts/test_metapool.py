from world import *

me = ORIGINTEAM
some_gas_price = 100
OPTS = {'from': me, "gas_price": some_gas_price}

# NOTICE(!)below address can change since it is deployed by the 040.convexMeta.js deploy
META_STRATEGY = '0x307a6343A4ecd5dF8F113fb7f1A78D792F81f91C'
CURVE3_POOL_DEPOSIT_ZAP = "0xA79828DF1850E8a3A3064576f380D90aECDD3359"
THREEPOOL_BAGS = '0xceaf7747579696a2f0bb206a14210e3c9e6fb269'
OUSD_BAGS = '0x8e02247d3ee0e6153495c971ffd45aa131f4d7cb'
OUSD_BAGS_2 = '0xc055de577ce2039e6d35621e3a885df9bb304ab9'
USDT_BAGS = '0x5754284f345afc66a98fbb0a0afe71e0f007b949'
THREEPOOL = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7'
CURVE_FACTORY = '0xB9fC157394Af804a3578134A6585C0dc9cc990d4'

TOTAL_AMOUNT = int(11e6) * int(1e18)

threepool_lp = load_contract('threepool_lp', THREEPOOL_LP)
ousd_metapool = load_contract('ousd_metapool', OUSD_METAPOOL)
threepool_swap = load_contract('threepool_swap', THREEPOOL)
threepool_deposit_zap = load_contract('curve_deposit_zap', CURVE3_POOL_DEPOSIT_ZAP)
curve_factory = load_contract('curve_factory', CURVE_FACTORY)

# 1. Acquire 3pool, ousd and usdt
threepool_lp.transfer(me, TOTAL_AMOUNT, {'from': THREEPOOL_BAGS})
ousd.transfer(me, 6*1e6*1e18, {'from': OUSD_BAGS})
usdt.transfer(me, 6*1e6*1e6, {'from': USDT_BAGS})
ousd.transfer(me, 5*1e6*1e18, {'from': OUSD_BAGS_2})

# approve ousd and 3poolLp to be used by ousd_metapool
threepool_lp.approve(ousd_metapool, int(1e50), OPTS)
ousd.approve(ousd_metapool, int(1e50), OPTS)

threepool_virtual_price = threepool_swap.get_virtual_price()
ousd_metapool_virtual_price = ousd_metapool.get_virtual_price()

# set ousd_metastrategy as default strategies for USDT & USDC in a governance proposal
tx = vault_admin.setAssetDefaultStrategy(usdt.address, META_STRATEGY, {'from': GOVERNOR})
#tx2 = vault_admin.setAssetDefaultStrategy(usdc.address, META_STRATEGY, {'from': GOVERNOR})
tx.sig_string = 'setAssetDefaultStrategy(address,address)'
#tx2.sig_string = 'setAssetDefaultStrategy(address,address)'
#create_gov_proposal("Set meta strategy as default strategy", [tx, tx2])
create_gov_proposal("Set meta strategy as default strategy", [tx])
sim_governor_execute(33)

# mint OUSD and make allocate deposit funds into the ousd meta strategy
usdt.balanceOf(me, OPTS)
usdt.approve(vault_core.address, int(0), OPTS)
usdt.approve(vault_core.address, int(1e50), OPTS)
vault_core.mint(usdt.address, 1000*1e6, 0, OPTS)
vault_core.allocate(OPTS)
vault_core.redeem(500*1e18, 250*1e18, OPTS)


# RANDOM STUFF
# vault_core.redeem(900*1e18, 850*1e18, OPTS)
# curve_factory.get_underlying_coins(ousd_metapool) # OUSD, DAI, USDC, USDT
# threepool_deposit_zap.calc_token_amount(ousd_metapool.address, [100*1e18, 100*1e18, 0, 200*1e18], True)
# ousd_metapool.add_liquidity([100*1e18, 100*1e18], 0, me, OPTS)
# ousd_metapool.add_liquidity([0, 1], 0, OPTS)
# END OF LEAVE STUFF HERE

#2. Deposit in metapool

# # Mix of funds

# out = []
# for mint_ratio in range(0, 21, 1):
#     mint_ratio = mint_ratio / 20.0
#     with TemporaryFork():
#         ousd_amount = TOTAL_AMOUNT * int(mint_ratio * 100) // int(100)
#         threepool_amount = int((TOTAL_AMOUNT - ousd_amount))
#         ousd_metapool.add_liquidity([ousd_amount, int(threepool_amount / threepool_virtual_price)], 0, me, OPTS)
#         out.append([mint_ratio, ousd_metapool.balanceOf(me) * ousd_metapool_virtual_price / TOTAL_AMOUNT, int(threepool_amount), int(ousd_amount)])
#         print(out[-1])


# print("-----")
# for line in out:
#     print(",".join([str(x) for x in line]))


# # 3Pool deposits only
# print("-----")
# out = []
# TOTAL_AMOUNT = int(11e6) * int(1e18)
# for mint_ratio in range(0, 20, 1):
#     mint_ratio = mint_ratio / 20.0
#     with TemporaryFork():
#         ousd_amount = TOTAL_AMOUNT * int(mint_ratio * 100) // int(100)
#         threepool_amount = int((TOTAL_AMOUNT - ousd_amount))
#         ousd_amount = 0
#         ousd_metapool.add_liquidity([ousd_amount, int(threepool_amount / threepool_virtual_price)], 0, me, OPTS)
#         out.append([mint_ratio, ousd_metapool.balanceOf(me) * ousd_metapool_virtual_price / threepool_amount, int(threepool_amount), int(ousd_amount)])
#         print(out[-1])


# print("-----")
# for line in out:
#     print(",".join([str(x) for x in line]))



# # Fixed deposit, slide OUSD

print("-----")
out = []
THREEPOOL_DEPOSIT_AMOUNT = int(5e6) * int(1e18)
MAX_OUSD_AMOUNT = int(5e6) * int(1e18)
for mint_ratio in range(0, 21, 1):
    mint_ratio = mint_ratio / 20.0
    with TemporaryFork():
        ousd_amount = MAX_OUSD_AMOUNT * int(mint_ratio * 100) // int(100)
        threepool_amount = THREEPOOL_DEPOSIT_AMOUNT
        total_deposit = ousd_amount + threepool_amount
        ousd_metapool.add_liquidity([ousd_amount, int(threepool_amount / threepool_virtual_price)], 0, me, OPTS)
        out.append([mint_ratio, ousd_metapool.balanceOf(me) * ousd_metapool_virtual_price / total_deposit, int(threepool_amount), int(ousd_amount)])
        print(out[-1])


print("-----")
for line in out:
    print(",".join([str(x) for x in line]))

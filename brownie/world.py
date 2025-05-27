from world_abstract import *

std = {'from': MULTICHAIN_STRATEGIST}

# ousd = Contract.from_explorer(OUSD, as_proxy_for=OUSD_IMPL)
# usdt = Contract.from_explorer(USDT)
# usdc = Contract.from_explorer(USDC)
# dai = Contract.from_explorer(DAI)
# flipper = Contract.from_explorer(FLIPPER)
# buyback = Contract.from_explorer(BUYBACK)
# ogn = Contract.from_explorer(OGN)
# vault_admin = Contract.from_explorer(VAULT_PROXY_ADDRESS,as_proxy_for=VAULT_ADMIN_IMPL)
# vault_core = Contract.from_explorer(VAULT_PROXY_ADDRESS,as_proxy_for=VAULT_CORE_IMPL)
# ousd_usdt = Contract.from_explorer(OUSD_USDT)
# v2router = Contract.from_explorer(UNISWAP_V2_ROUTER)

frax = load_contract('ERC20', FRAX)
busd = load_contract('ERC20', BUSD)
weth = load_contract('ERC20', WETH)
ousd = load_contract('ousd', OUSD)
oeth = load_contract('ousd', OETH)
woeth = load_contract('erc4626', WOETH)
usdt = load_contract('usdt', USDT)
usdc = load_contract('usdc', USDC)
dai = load_contract('dai', DAI)
steth = load_contract('ERC20', STETH)
wsteth = load_contract('wsteth', WSTETH)
sfrxeth = load_contract('ERC20', SFRXETH)
frxeth = load_contract('ERC20', FRXETH)
reth = load_contract('ERC20', RETH)
ssv = load_contract('ERC20', SSV)

flipper = load_contract('flipper', FLIPPER)
ousd_buyback = load_contract('buyback', OUSD_BUYBACK)
oeth_buyback = load_contract('buyback', OETH_BUYBACK)
ogn = load_contract('ogn', OGN)
ogv = load_contract('ogv', OGV)
veogv = load_contract('veogv', VEOGV)
vault_admin = load_contract('vault_admin', VAULT_PROXY_ADDRESS)
vault_core = load_contract('vault_core', VAULT_PROXY_ADDRESS)
vault_oeth_admin = load_contract('vault_admin', VAULT_OETH_PROXY_ADDRESS)
vault_oeth_core = load_contract('vault_core', VAULT_OETH_PROXY_ADDRESS)
vault_value_checker = load_contract('vault_value_checker', VAULT_VALUE_CHECKER)
oeth_vault_value_checker = load_contract('vault_value_checker', OETH_VAULT_VALUE_CHECKER)
dripper = load_contract('dripper', DRIPPER)
oeth_dripper = load_contract('dripper', OETH_DRIPPER)
harvester = load_contract('harvester', HARVESTER)
ousd_usdt = load_contract('ousd_usdt', OUSD_USDT)
v2router = load_contract('v2router', UNISWAP_V2_ROUTER)
aave_strat = load_contract('aave_strat', AAVE_STRAT)
comp_strat = load_contract('comp_strat', COMP_STRAT)
convex_strat = load_contract('convex_strat', CONVEX_STRAT)
ousd_meta_strat = load_contract('ousd_metastrat', OUSD_METASTRAT)
ousd_curve_amo_strat = load_contract('ousd_curve_amo_strat', OUSD_CURVE_AMO_STRAT)
morpho_comp_strat = load_contract('morpho_comp_strat', MORPHO_COMP_STRAT)
morpho_aave_strat = load_contract('morpho_aave_strat', MORPHO_AAVE_STRAT)
lusd_3pool_strat = load_contract('lusd_3pool_strat', LUSD_3POOL_STRAT)
oeth_morpho_aave_strat = load_contract('morpho_aave_strat', OETH_MORPHO_AAVE_STRAT)
oeth_meta_strat = load_contract('oeth_meta_strat', OETH_CONVEX_OETH_ETH_STRAT)
oeth_curve_amo_strat = load_contract('ousd_curve_amo_strat', OETH_CURVE_AMO_STRAT)
flux_strat = load_contract('comp_strat', FLUX_STRAT)
frxeth_redeem_strat = load_contract('frxeth_redeem_strat', OETH_FRAX_ETH_REDEEM_STRAT)
native_staking_strat = load_contract('native_staking_strat', OETH_NATIVE_STAKING_STRAT)
native_staking_2_strat = load_contract('native_staking_strat', OETH_NATIVE_STAKING_2_STRAT)
lido_withdrawal_strat = load_contract('lido_withdrawal_strat', OETH_LIDO_WITHDRAWAL_STRAT)

ousd_metapool = load_contract("ousd_metapool", OUSD_METAPOOL)
threepool = load_contract("threepool_swap", THREEPOOL)
ousd_curve_pool = load_contract("ousd_curve_pool", OUSD_CURVE_POOL)

aave_incentives_controller = load_contract('aave_incentives_controller', '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5')
stkaave = load_contract('stkaave', '0x4da27a545c0c5B758a6BA100e3a049001de870f5')

strategist = brownie.accounts.at(STRATEGIST, force=True)
timelock = brownie.accounts.at(TIMELOCK, force=True)
gova = brownie.accounts.at(GOVERNOR, force=True)
governor = load_contract('governor', GOVERNOR)
governor_five = load_contract('governor_five', GOVERNOR_FIVE)
governor_six = load_contract('governor_five', '0x1D3Fbd4d129Ddd2372EA85c5Fa00b2682081c9EC')
timelock_contract = load_contract('timelock', TIMELOCK)
rewards_source = load_contract('rewards_source', REWARDS_SOURCE)


weth = load_contract('weth', WETH)
reth = load_contract('ERC20', RETH)
steth = load_contract('ERC20', STETH)
frxeth = load_contract('ERC20', FRXETH)
sfrxeth = load_contract('ERC20', SFRXETH)
oeth_vault_admin = load_contract('vault_admin', OETH_VAULT)
oeth_vault_core = load_contract('vault_core', OETH_VAULT)
oeth_metapool = load_contract('oeth_metapool', OETH_METAPOOL)
oeth_curve_pool = load_contract('ousd_curve_pool', OETH_CURVE_POOL)

woeth = load_contract('wrapped_ousd', WOETH)
ccip_router = load_contract('ccip_router', CCIP_ROUTER)
zapper = load_contract('oethzapper', OETH_ZAPPER)

cvx_locker = load_contract('cvx_locker', CVX_LOCKER)
cvx = load_contract('ERC20', CVX)

uniswap_v3_quoter = load_contract('uniswap_v3_quoter', UNISWAP_V3_QUOTER)

oeth_arm = load_contract('oeth_arm', OETH_ARM)

superbridge = load_contract('superbridge', SUPERBRIDGE_ETH)

CONTRACT_ADDRESSES = {}
CONTRACT_ADDRESSES[VAULT_PROXY_ADDRESS.lower()] = {'name': 'Vault'}
CONTRACT_ADDRESSES[HARVESTER.lower()] = {'name': 'Harvester'}
CONTRACT_ADDRESSES[DRIPPER.lower()] = {'name': 'Dripper'}

inv_contracts_map = {v.lower(): k.lower() for k, v in addresses.__dict__.items() if not (k.startswith('__') or k.startswith('_'))}

COINS = {
    '0xd533a949740bb3306d119cc777fa900ba034cd52': {'name': 'CRV', 'decimals': 18},
    '0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b': {'name': 'CVX', 'decimals': 18},
    '0xc00e94cb662c3520282e6f5717214004a7f26888': {'name': 'COMP', 'decimals': 18},
    '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': {'name': 'AAVE', 'decimals': 18},
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {'name': 'WETH', 'decimals': 18},
    '0xdac17f958d2ee523a2206206994597c13d831ec7': {'name': 'USDT', 'decimals': 6},
    USDC.lower(): {'name': 'USDC', 'decimals': 6},
    DAI.lower(): {'name': 'DAI', 'decimals': 18},
    '0x4da27a545c0c5b758a6ba100e3a049001de870f5': {'name': 'STKAAVE', 'decimals': 18},
    OUSD.lower(): {'name': 'OUSD', 'decimals': 18},
    }

threepool = brownie.Contract.from_abi(
        "ThreePool",
        "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
        [{"name":"TokenExchange","inputs":[{"type":"address","name":"buyer","indexed":True},{"type":"int128","name":"sold_id","indexed":False},{"type":"uint256","name":"tokens_sold","indexed":False},{"type":"int128","name":"bought_id","indexed":False},{"type":"uint256","name":"tokens_bought","indexed":False}],"anonymous":False,"type":"event"},{"name":"AddLiquidity","inputs":[{"type":"address","name":"provider","indexed":True},{"type":"uint256[3]","name":"token_amounts","indexed":False},{"type":"uint256[3]","name":"fees","indexed":False},{"type":"uint256","name":"invariant","indexed":False},{"type":"uint256","name":"token_supply","indexed":False}],"anonymous":False,"type":"event"},{"name":"RemoveLiquidity","inputs":[{"type":"address","name":"provider","indexed":True},{"type":"uint256[3]","name":"token_amounts","indexed":False},{"type":"uint256[3]","name":"fees","indexed":False},{"type":"uint256","name":"token_supply","indexed":False}],"anonymous":False,"type":"event"},{"name":"RemoveLiquidityOne","inputs":[{"type":"address","name":"provider","indexed":True},{"type":"uint256","name":"token_amount","indexed":False},{"type":"uint256","name":"coin_amount","indexed":False}],"anonymous":False,"type":"event"},{"name":"RemoveLiquidityImbalance","inputs":[{"type":"address","name":"provider","indexed":True},{"type":"uint256[3]","name":"token_amounts","indexed":False},{"type":"uint256[3]","name":"fees","indexed":False},{"type":"uint256","name":"invariant","indexed":False},{"type":"uint256","name":"token_supply","indexed":False}],"anonymous":False,"type":"event"},{"name":"CommitNewAdmin","inputs":[{"type":"uint256","name":"deadline","indexed":True},{"type":"address","name":"admin","indexed":True}],"anonymous":False,"type":"event"},{"name":"NewAdmin","inputs":[{"type":"address","name":"admin","indexed":True}],"anonymous":False,"type":"event"},{"name":"CommitNewFee","inputs":[{"type":"uint256","name":"deadline","indexed":True},{"type":"uint256","name":"fee","indexed":False},{"type":"uint256","name":"admin_fee","indexed":False}],"anonymous":False,"type":"event"},{"name":"NewFee","inputs":[{"type":"uint256","name":"fee","indexed":False},{"type":"uint256","name":"admin_fee","indexed":False}],"anonymous":False,"type":"event"},{"name":"RampA","inputs":[{"type":"uint256","name":"old_A","indexed":False},{"type":"uint256","name":"new_A","indexed":False},{"type":"uint256","name":"initial_time","indexed":False},{"type":"uint256","name":"future_time","indexed":False}],"anonymous":False,"type":"event"},{"name":"StopRampA","inputs":[{"type":"uint256","name":"A","indexed":False},{"type":"uint256","name":"t","indexed":False}],"anonymous":False,"type":"event"},{"outputs":[],"inputs":[{"type":"address","name":"_owner"},{"type":"address[3]","name":"_coins"},{"type":"address","name":"_pool_token"},{"type":"uint256","name":"_A"},{"type":"uint256","name":"_fee"},{"type":"uint256","name":"_admin_fee"}],"stateMutability":"nonpayable","type":"constructor"},{"name":"A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":5227},{"name":"get_virtual_price","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":1133537},{"name":"calc_token_amount","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"bool","name":"deposit"}],"stateMutability":"view","type":"function","gas":4508776},{"name":"add_liquidity","outputs":[],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"uint256","name":"min_mint_amount"}],"stateMutability":"nonpayable","type":"function","gas":6954858},{"name":"get_dy","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"stateMutability":"view","type":"function","gas":2673791},{"name":"get_dy_underlying","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"stateMutability":"view","type":"function","gas":2673474},{"name":"exchange","outputs":[],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"},{"type":"uint256","name":"min_dy"}],"stateMutability":"nonpayable","type":"function","gas":2818066},{"name":"remove_liquidity","outputs":[],"inputs":[{"type":"uint256","name":"_amount"},{"type":"uint256[3]","name":"min_amounts"}],"stateMutability":"nonpayable","type":"function","gas":192846},{"name":"remove_liquidity_imbalance","outputs":[],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"uint256","name":"max_burn_amount"}],"stateMutability":"nonpayable","type":"function","gas":6951851},{"name":"calc_withdraw_one_coin","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"_token_amount"},{"type":"int128","name":"i"}],"stateMutability":"view","type":"function","gas":1102},{"name":"remove_liquidity_one_coin","outputs":[],"inputs":[{"type":"uint256","name":"_token_amount"},{"type":"int128","name":"i"},{"type":"uint256","name":"min_amount"}],"stateMutability":"nonpayable","type":"function","gas":4025523},{"name":"ramp_A","outputs":[],"inputs":[{"type":"uint256","name":"_future_A"},{"type":"uint256","name":"_future_time"}],"stateMutability":"nonpayable","type":"function","gas":151919},{"name":"stop_ramp_A","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":148637},{"name":"commit_new_fee","outputs":[],"inputs":[{"type":"uint256","name":"new_fee"},{"type":"uint256","name":"new_admin_fee"}],"stateMutability":"nonpayable","type":"function","gas":110461},{"name":"apply_new_fee","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":97242},{"name":"revert_new_parameters","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21895},{"name":"commit_transfer_ownership","outputs":[],"inputs":[{"type":"address","name":"_owner"}],"stateMutability":"nonpayable","type":"function","gas":74572},{"name":"apply_transfer_ownership","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":60710},{"name":"revert_transfer_ownership","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21985},{"name":"admin_balances","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"i"}],"stateMutability":"view","type":"function","gas":3481},{"name":"withdraw_admin_fees","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21502},{"name":"donate_admin_fees","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":111389},{"name":"kill_me","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":37998},{"name":"unkill_me","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":22135},{"name":"coins","outputs":[{"type":"address","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function","gas":2220},{"name":"balances","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function","gas":2250},{"name":"fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2171},{"name":"admin_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2201},{"name":"owner","outputs":[{"type":"address","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2231},{"name":"initial_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2261},{"name":"future_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2291},{"name":"initial_A_time","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2321},{"name":"future_A_time","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2351},{"name":"admin_actions_deadline","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2381},{"name":"transfer_ownership_deadline","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2411},{"name":"future_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2441},{"name":"future_admin_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2471},{"name":"future_owner","outputs":[{"type":"address","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2501}]
    )

GREEN = '\033[92m'
CYAN = '\033[96m'
ORANGE = '\033[93m'
ENDC = '\033[0m'

def get_erc20_name(address):
    return load_contract('ERC20', address).name()

# show transfers of a transaction
def show_transfers(tx):
    TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    for log in tx.logs:
        if log.topics and log.topics[0].hex() == TRANSFER:
            coin = log.address[0:10]
            amount = str(int(log.data, 16))
            if log.address.lower() in COINS:
                coin = COINS[log.address.lower()]['name']
                amount = commas(int(log.data, 16), COINS[log.address.lower()]['decimals'])
            from_label = '0x' + log.topics[1].hex().replace("0x000000000000000000000000",'')
            to_label = '0x' + log.topics[2].hex().replace("0x000000000000000000000000",'')
            if from_label.lower() in CONTRACT_ADDRESSES:
                from_label = CONTRACT_ADDRESSES[from_label.lower()]['name']
            if to_label.lower() in CONTRACT_ADDRESSES:
                to_label = CONTRACT_ADDRESSES[to_label.lower()]['name']
            print("\t".join([
                leading_whitespace(coin, 10),
                leading_whitespace(from_label, 42),
                leading_whitespace(to_label, 42),
                amount
                ]))

# show complete vault holdings: stable coins & strategies
def show_vault_holdings():
    total = vault_core.totalValue()
    print("  Total: "+c18(vault_core.totalValue()))
    print("----------- Vault Holdings --------------")

    print("Stables:                     ", end='')
    print(c18(dai.balanceOf(vault_core.address)) + ' DAI   ', end='')
    print(c6(usdc.balanceOf(vault_core.address)) + ' USDC  ', end='')
    print(c6(usdt.balanceOf(vault_core.address)) + ' USDT  ')
    print("AAVE:                        ", end='')
    print(c18(aave_strat.checkBalance(DAI))+ ' DAI    ', end='')
    print(c6(aave_strat.checkBalance(USDC))+ ' USDC   ', end='')
    print(c6(aave_strat.checkBalance(USDT))+ ' USDT   ')
    print("COMP:                        ", end='')
    print(c18(comp_strat.checkBalance(DAI)) + ' DAI   ', end='')
    print(c6(comp_strat.checkBalance(USDC)) + ' USDC  ', end='')
    print(c6(comp_strat.checkBalance(USDT)) + ' USDT  ')
    print("Convex:                      ", end='')
    convex_total = convex_strat.checkBalance(DAI) + convex_strat.checkBalance(USDC) * 1e12 + convex_strat.checkBalance(USDT) * 1e12
    convex_pct =  float(convex_total) / float(total) * 100
    print(c18(convex_total) + ' ({:0.2f}%)'.format(convex_pct))
    print("----------------------------------------")

def show_ousd_supply():
    vaultTotalValue = vault_core.totalValue()
    ousdTotalSupply = ousd.totalSupply()
    rate = vaultTotalValue / ousdTotalSupply
    print("-------------- Ousd Supply ---------------")
    print("Vault value:         " + c18(vaultTotalValue))
    print("OUSD total supply:   " + c18(ousdTotalSupply))
    print("Vault/OUSD diff:     " + c18(vaultTotalValue-ousdTotalSupply))
    print("Rate:                " + leading_whitespace('{:0.4f}%'.format(rate)))
    print("------------------------------------------")

def show_aave_rewards():
    print("==== AAVE Rewards ====")
    uncollected = aave_incentives_controller.getRewardsBalance(['0x028171bCA77440897B824Ca71D1c56caC55b68A3'], aave_strat)
    print("  AAVE Uncollected: "+c18(uncollected))
    timelocked = stkaave.balanceOf(AAVE_STRAT)
    print("   AAVE Timelocked: "+c18(timelocked))
    days_to_sell = -1 * (int(time.time()-stkaave.stakersCooldowns(aave_strat)) - stkaave.COOLDOWN_SECONDS()) / 60 / 60 / 24
    print("      Days to sell: {days_to_sell:16.2f}".format(days_to_sell=days_to_sell))


def create_gov_proposal(title, txs):
    tx = governor_six.propose(
        [x.receiver for x in txs],
        [0 for x in txs],
        [x.sig_string for x in txs],
        ['0x'+x.input[10:] for x in txs],
        title,
        {'from': GOV_MULTISIG}
    )
    tx.info()
    print("---------------------")
    print("Use these parameters to propose from metamask")
    print("TO: "+tx.receiver)
    print("DATA: "+tx.input)
    print("---------------------")
    return tx.events['ProposalCreated']['proposalId']

def sim_governor_execute(id):
    governor.queue(id, {'from': GOV_MULTISIG})
    brownie.chain.sleep(48*60*60+1)
    governor.execute(id, {'from': GOV_MULTISIG})
    print("Executed %s" % id)

def show_ousd_metastrat_underlying_balance():
    crv3_metapool = load_contract("ousd_metapool", THREEPOOL)
    crv3_metapool_lp_price = crv3_metapool.get_virtual_price()

    ousd_metapool = load_contract("ousd_metapool", OUSD_METAPOOL)
    ousd_metapool_lp_price = ousd_metapool.get_virtual_price()

    ousd_metapool_total = ousd_metapool.balances(0) + ousd_metapool.balances(1)
    ousd_metapool_ousd_pct = ousd_metapool.balances(0) / ousd_metapool_total
    ousd_metapool_3crv_pct = ousd_metapool.balances(1) / ousd_metapool_total

    # Staked bal
    cvx_rewards_staking = load_contract("ERC20", CVX_REWARDS_POOL)
    staked_bal = cvx_rewards_staking.balanceOf(OUSD_METASTRAT)

    print("---------------------")
    print("3CRV MetaPool: {}".format(crv3_metapool.address))
    print("3CRV MetaPool LP Price: {}".format(prices(crv3_metapool_lp_price)))
    print("---------------------")
    print("OUSD MetaPool: {}".format(crv3_metapool.address))
    print("OUSD MetaPool Split: OUSD: {:.2f}% & 3CRV: {:.2f}%".format(
        ousd_metapool_ousd_pct * 100,
        ousd_metapool_3crv_pct * 100,
    ))
    print("---------------------")
    print("CVX Rewards: {}".format(cvx_rewards_staking.address))
    print("CVX Rewards Staked: {}".format(commas(staked_bal)))

    total_lp_owned = staked_bal

    for asset in (dai, usdt, usdc):
        ptoken_addr = ousd_meta_strat.assetToPToken(asset.address)
        ptoken_contract = load_contract('ERC20', ptoken_addr)

        # Unstaked LP tokens
        unstaked_ptoken_bal = ptoken_contract.balanceOf(CVX_REWARDS_POOL)

        total_lp_owned += unstaked_ptoken_bal

        print("---------------------")
        print("Asset: {} ({})".format(asset.symbol(), asset.address))
        print("PToken: {} ({})".format(ptoken_contract.symbol(), ptoken_addr))
        print("PToken Bal (Unstaked): {}".format(unstaked_ptoken_bal, ptoken_contract.decimals()))

    total_ousd_lp_value = total_lp_owned * ousd_metapool_ousd_pct * ousd_metapool_lp_price / 1e18
    total_3crv_lp_value = total_lp_owned * ousd_metapool_3crv_pct * crv3_metapool_lp_price / 1e18
    underlying_asset = {}
    total_underlying = 0

    for i in range(0, 3):
        address = crv3_metapool.coins(i)
        balance = crv3_metapool.balances(i)
        if address in (usdt.address, usdc.address):
            # Scale to 18 decimals
            balance = balance * 10**12
        underlying_asset[address] = balance
        total_underlying += balance

    print("---------------------")
    print("Total LP Owned: {}".format(commas(total_lp_owned)))
    print("Total OUSD LP Value: {}".format(commas(total_ousd_lp_value)))
    print("Total 3CRV LP Value: {}".format(commas(total_3crv_lp_value)))
    
    print("---------------------")
    print("OUSD ({:.2f}%): {}".format(ousd_metapool_ousd_pct * 100, commas(total_ousd_lp_value)))
    for asset in (dai, usdt, usdc):
        underlying_pct = underlying_asset[asset.address] / total_underlying
        scaled_balance = commas(total_3crv_lp_value * underlying_pct, 18)
        print("{} ({:.2f}%): {}".format(asset.symbol(), underlying_pct * 100 / 2, scaled_balance))
    print("---------------------")

# show changes in Vault's & OUSD's supply once the code block exits 
class SupplyChanges:
    def __init__(self, txOptions):
        self.txOptions=txOptions

    def __enter__(self):
        self.vaultTotalValue = vault_core.totalValue(self.txOptions)
        self.ousdTotalSupply = ousd.totalSupply(self.txOptions)
        # TODO: Uncomment once this becomes available
        #self.netOusdMinted = vault_core.netOusdMintedForStrategy()
        return self

    def __exit__(self, *args, **kwargs):
        vaultTotalValue = vault_core.totalValue(self.txOptions)
        ousdTotalSupply = ousd.totalSupply(self.txOptions)
        # TODO: Uncomment once this becomes available
        #netOusdMinted = vault_core.netOusdMintedForStrategy()
        rateBefore = self.vaultTotalValue / self.ousdTotalSupply
        rateAfter = vaultTotalValue / ousdTotalSupply

        print("----------- Supply Changes -------------")
        print("                      " + leading_whitespace("Before") + " " + leading_whitespace("After") + " " + leading_whitespace("Difference"))
        print("Vault value :         " + c18(self.vaultTotalValue) + " " + c18(vaultTotalValue) + " " + c18(vaultTotalValue - self.vaultTotalValue))
        print("OUSD total supply :   " + c18(self.ousdTotalSupply) + " " + c18(ousdTotalSupply) + " " + c18(ousdTotalSupply - self.ousdTotalSupply))
        print("Vault/OUSD diff :     " + c18(self.vaultTotalValue-self.ousdTotalSupply) + " " + c18(vaultTotalValue-ousdTotalSupply) + " " + c18(self.vaultTotalValue-self.ousdTotalSupply - (vaultTotalValue-ousdTotalSupply)))
        print("Rate change :         " + leading_whitespace('{:0.4f}%'.format(rateBefore)) + " " + leading_whitespace('{:0.4f}%'.format(rateAfter)) + " " + leading_whitespace('{:0.4f}%'.format(rateAfter - rateBefore)))
        # TODO: Uncomment once this becomes available
        # print("OUSD strategy minted: " + c18(self.netOusdMinted) + " " + c18(netOusdMinted) + " " + c18(netOusdMinted - self.netOusdMinted))
        print("----------------------------------------")
        

def show_proposal(id):
    state = ['New','Queue','Expired','Executed'][governor.state(id)]
    prop = governor.proposals(id)
    actions = governor.getActions(id)
    if state == 'Queue':
        remaining_hours = int((prop[2] - time.time()) / 60 / 60 * 100) / 100
        if remaining_hours > 0:
            print("📅 #{:} [{:}] with {:.2f} hours remaining in timelock".format(id, state, remaining_hours))
        else:
            remaining_hours += 48.0
            print("⚛️  #{:} [{:}] with {:.2f} hours remaining in window".format(id, state, remaining_hours))
    elif state == 'New':
        print("🎀 #{:} [{:}]".format(id, state))
    elif state == 'Expired':
        print("💀 #{:} [{:}]".format(id, state))
    elif state == 'Executed':
        print("✅ #{:} [{:}]".format(id, state))
    else:
        raise "Unknown state"

def show_proposals(n=3):
    cnt = governor.proposalCount()
    for id in range(cnt,cnt-n, -1):
        show_proposal(id)

def nice_contract_address(address):
  address = address.lower()
  if address in inv_contracts_map:
    return "%s   %s" % (ORANGE+inv_contracts_map[address]+ENDC, CYAN+address+ENDC)
  else:
    return address


def show_governance_action(i, to, sig, data):
    print("{}) {}".format(i+1, nice_contract_address(to)))
    print("     "+ORANGE+sig+ENDC)
    # print("Post Sig Data: ", data)
    if re.match(".*\(\)", sig):
        return

    split_sig = re.split("^[^\(]*", sig)[1]
    split_sig = re.split(",|\)$|^\(", split_sig)[1:-1]

    stypes = []
    nested_struct = []
    nested = False
    for s in split_sig:
        if s.startswith("("):
            stypes.append([s[1:]])
            nested = True
        elif s.endswith(")"):
            stypes[len(stypes) - 1].append(s[:-1])
            stypes[len(stypes) - 1] = "({})".format(",".join(stypes[len(stypes) - 1]))
            nested = False
        elif nested:
            stypes[len(stypes) - 1].append(s)
        else:
            stypes.append(s)

    decodes = abi.decode_abi(stypes, data)
    for j in range(0, len(stypes)):
        v = decodes[j]
        if stypes[j] == "address":
            print(" >> ", nice_contract_address(v))
        elif stypes[j] == "bytes":
            print(" >> ", v.hex())
        else:
            print(" >> ", ORANGE+str(v)+ENDC)

def show_txs_data(txs):
    print("Schedule the following transactions on Gnosis Safe")
    for idx, item in enumerate(txs):
        print("Transaction ", idx)
        print("To: ", item.receiver)
        print("Data (Hex encoded): ", item.input, "\n")

class TemporaryForkForOUSD:
    def __enter__(self, profit_variance, vault_value_variance):
        self.txs = []
        self.profit_variance = profit_variance
        self.vault_value_variance = vault_value_variance
        brownie.chain.snapshot()

        # Before
        self.txs.append(vault_core.rebase(std))
        self.txs.append(vault_value_checker.takeSnapshot(std))

        return self.txs

    def __exit__(self, *args, **kwargs):
        vault_change = vault_core.totalValue() - vault_value_checker.snapshots(STRATEGIST)[0]
        supply_change = ousd.totalSupply() - vault_value_checker.snapshots(STRATEGIST)[1]
        profit = vault_change - supply_change

        self.txs.append(
            vault_value_checker.checkDelta(
                profit, 
                self.profit_variance, 
                vault_change, 
                self.vault_value_variance, 
                std
            )
        )
        print("-----")
        print("Profit", "{:.6f}".format(profit / 10**18), profit)
        print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

        brownie.chain.revert()
        print("----")
        print("Gnosis json:")
        print(to_gnosis_json(self.txs))
        print("----")

class TemporaryForkForOETH:
    def __enter__(self, profit_variance, vault_value_variance):
        self.txs = []
        self.profit_variance = profit_variance
        self.vault_value_variance = vault_value_variance
        brownie.chain.snapshot()

        # Before
        self.txs.append(vault_oeth_core.rebase(std))
        self.txs.append(oeth_vault_value_checker.takeSnapshot(std))

        return self.txs

    def __exit__(self, *args, **kwargs):
        vault_change = vault_oeth_core.totalValue() - oeth_vault_value_checker.snapshots(STRATEGIST)[0]
        supply_change = oeth.totalSupply() - oeth_vault_value_checker.snapshots(STRATEGIST)[1]
        profit = vault_change - supply_change

        self.txs.append(
            oeth_vault_value_checker.checkDelta(
                profit, 
                self.profit_variance, 
                vault_change, 
                self.vault_value_variance, 
                std
            )
        )
        print("-----")
        print("Profit", "{:.6f}".format(profit / 10**18), profit)
        print("Vault Change", "{:.6f}".format(vault_change / 10**18), vault_change)

        brownie.chain.revert()
        print("----")
        print("Gnosis json:")
        print(to_gnosis_json(self.txs))
        print("----")


def show_governor_four_proposal_actions(proposal_id):
    actions = governor.getActions(proposal_id)
    for i in range(0, len(actions[0])):
        print("")
        show_governance_action(
            i=i, to=actions[0][i], sig=actions[1][i], data=actions[2][i]
        )


def show_governor_five_proposal_actions(proposal_id):
    actions = governor_five.getActions(proposal_id)
    for i in range(0, len(actions[0])):
        print("")
        show_governance_action(
            i=i, to=actions[0][i], sig=actions[2][i], data=actions[3][i]
        )
        if actions[1][i] != 0:
            print("    TRANSFERS ETH!!! %d !!!", actions[1][i])


def sim_execute_governor_five(proposal_id):
    """
    Bypasses the actual timelock/voting and just calls each governance action
    as if the timelock sent the transaction individually.

    This skips the governance process time and block delays.
    """
    actions = governor_five.getActions(proposal_id)
    timelock = brownie.accounts.at(TIMELOCK, force=True)
    for i in range(0, len(actions[0])):
        show_governance_action(
            i=i, to=actions[0][i], sig=actions[2][i], data=actions[3][i]
        )
        # Build actual data
        sighash = brownie.web3.keccak(text=actions[2][i]).hex()[:10]
        data = sighash + str(actions[3][i])[2:]
        # Send it
        timelock.transfer(to=actions[0][i], data=data, amount=actions[1][i])

def sim_execute_governor_six(proposal_id):
    """
    Bypasses the actual timelock/voting and just calls each governance action
    as if the timelock sent the transaction individually.

    This skips the governance process time and block delays.
    """
    actions = governor_six.getActions(proposal_id)
    timelock = brownie.accounts.at(TIMELOCK, force=True)
    for i in range(0, len(actions[0])):
        show_governance_action(
            i=i, to=actions[0][i], sig=actions[2][i], data=actions[3][i]
        )
        # Build actual data
        sighash = brownie.web3.keccak(text=actions[2][i]).hex()[:10]
        data = sighash + str(actions[3][i])[2:]
        # Send it
        timelock.transfer(to=actions[0][i], data=data, amount=actions[1][i])

@contextmanager
def silent_tx():
    """
    Hide std out transaction information printing.

    ETH brownie does not currently have a way to silence transaction details.
    """
    f = io.StringIO()
    with redirect_stdout(f):
        yield

import  brownie
from addresses import *
import json
import time
std = {'from': STRATEGIST}

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

def abi_to_disk(name, contract):
    with open("abi/%s.json" % name, 'w') as f:
        json.dump(contract.abi, f)

def load_contract(name, address):
    with open("abi/%s.json" % name, 'r') as f:
        abi = json.load(f)
        return brownie.Contract.from_abi(name, address, abi)

ousd = load_contract('ousd', OUSD)
usdt = load_contract('usdt', USDT)
usdc = load_contract('usdc', USDC)
dai = load_contract('dai', DAI)
flipper = load_contract('flipper', FLIPPER)
buyback = load_contract('buyback', BUYBACK)
ogn = load_contract('ogn', OGN)
vault_admin = load_contract('vault_admin', VAULT_PROXY_ADDRESS)
vault_core = load_contract('vault_core', VAULT_PROXY_ADDRESS)
vault_value_checker = load_contract('vault_value_checker', VAULT_VALUE_CHECKER)
dripper = load_contract('dripper', DRIPPER)
harvester = load_contract('harvester', HARVESTER)
ousd_usdt = load_contract('ousd_usdt', OUSD_USDT)
v2router = load_contract('v2router', UNISWAP_V2_ROUTER)
aave_strat = load_contract('aave_strat', AAVE_STRAT)
comp_strat = load_contract('comp_strat', COMP_STRAT)
convex_strat = load_contract('convex_strat', CONVEX_STRAT)

aave_incentives_controller = load_contract('aave_incentives_controller', '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5')
stkaave = load_contract('stkaave', '0x4da27a545c0c5B758a6BA100e3a049001de870f5')

strategist = brownie.accounts.at(STRATEGIST, force=True)
gova = brownie.accounts.at(GOVERNOR, force=True)
governor = load_contract('governor', GOVERNOR)

CONTRACT_ADDRESSES = {}
CONTRACT_ADDRESSES[VAULT_PROXY_ADDRESS.lower()] = {'name': 'Vault'}
CONTRACT_ADDRESSES[HARVESTER.lower()] = {'name': 'Harvester'}
CONTRACT_ADDRESSES[DRIPPER.lower()] = {'name': 'Dripper'}

COINS = {
    '0xd533a949740bb3306d119cc777fa900ba034cd52': {'name': 'CRV', 'decimals': 18},
    '0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b': {'name': 'CVX', 'decimals': 18},
    '0xc00e94cb662c3520282e6f5717214004a7f26888': {'name': 'COMP', 'decimals': 18},
    '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': {'name': 'AAVE', 'decimals': 18},
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {'name': 'WETH', 'decimals': 18},
    '0xdac17f958d2ee523a2206206994597c13d831ec7': {'name': 'USDT', 'decimals': 6},
    '0x4da27a545c0c5b758a6ba100e3a049001de870f5': {'name': 'STKAAVE', 'decimals': 18},
    }

threepool = brownie.Contract.from_abi(
        "ThreePool",
        "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
        [{"name":"TokenExchange","inputs":[{"type":"address","name":"buyer","indexed":True},{"type":"int128","name":"sold_id","indexed":False},{"type":"uint256","name":"tokens_sold","indexed":False},{"type":"int128","name":"bought_id","indexed":False},{"type":"uint256","name":"tokens_bought","indexed":False}],"anonymous":False,"type":"event"},{"name":"AddLiquidity","inputs":[{"type":"address","name":"provider","indexed":True},{"type":"uint256[3]","name":"token_amounts","indexed":False},{"type":"uint256[3]","name":"fees","indexed":False},{"type":"uint256","name":"invariant","indexed":False},{"type":"uint256","name":"token_supply","indexed":False}],"anonymous":False,"type":"event"},{"name":"RemoveLiquidity","inputs":[{"type":"address","name":"provider","indexed":True},{"type":"uint256[3]","name":"token_amounts","indexed":False},{"type":"uint256[3]","name":"fees","indexed":False},{"type":"uint256","name":"token_supply","indexed":False}],"anonymous":False,"type":"event"},{"name":"RemoveLiquidityOne","inputs":[{"type":"address","name":"provider","indexed":True},{"type":"uint256","name":"token_amount","indexed":False},{"type":"uint256","name":"coin_amount","indexed":False}],"anonymous":False,"type":"event"},{"name":"RemoveLiquidityImbalance","inputs":[{"type":"address","name":"provider","indexed":True},{"type":"uint256[3]","name":"token_amounts","indexed":False},{"type":"uint256[3]","name":"fees","indexed":False},{"type":"uint256","name":"invariant","indexed":False},{"type":"uint256","name":"token_supply","indexed":False}],"anonymous":False,"type":"event"},{"name":"CommitNewAdmin","inputs":[{"type":"uint256","name":"deadline","indexed":True},{"type":"address","name":"admin","indexed":True}],"anonymous":False,"type":"event"},{"name":"NewAdmin","inputs":[{"type":"address","name":"admin","indexed":True}],"anonymous":False,"type":"event"},{"name":"CommitNewFee","inputs":[{"type":"uint256","name":"deadline","indexed":True},{"type":"uint256","name":"fee","indexed":False},{"type":"uint256","name":"admin_fee","indexed":False}],"anonymous":False,"type":"event"},{"name":"NewFee","inputs":[{"type":"uint256","name":"fee","indexed":False},{"type":"uint256","name":"admin_fee","indexed":False}],"anonymous":False,"type":"event"},{"name":"RampA","inputs":[{"type":"uint256","name":"old_A","indexed":False},{"type":"uint256","name":"new_A","indexed":False},{"type":"uint256","name":"initial_time","indexed":False},{"type":"uint256","name":"future_time","indexed":False}],"anonymous":False,"type":"event"},{"name":"StopRampA","inputs":[{"type":"uint256","name":"A","indexed":False},{"type":"uint256","name":"t","indexed":False}],"anonymous":False,"type":"event"},{"outputs":[],"inputs":[{"type":"address","name":"_owner"},{"type":"address[3]","name":"_coins"},{"type":"address","name":"_pool_token"},{"type":"uint256","name":"_A"},{"type":"uint256","name":"_fee"},{"type":"uint256","name":"_admin_fee"}],"stateMutability":"nonpayable","type":"constructor"},{"name":"A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":5227},{"name":"get_virtual_price","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":1133537},{"name":"calc_token_amount","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"bool","name":"deposit"}],"stateMutability":"view","type":"function","gas":4508776},{"name":"add_liquidity","outputs":[],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"uint256","name":"min_mint_amount"}],"stateMutability":"nonpayable","type":"function","gas":6954858},{"name":"get_dy","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"stateMutability":"view","type":"function","gas":2673791},{"name":"get_dy_underlying","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"stateMutability":"view","type":"function","gas":2673474},{"name":"exchange","outputs":[],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"},{"type":"uint256","name":"min_dy"}],"stateMutability":"nonpayable","type":"function","gas":2818066},{"name":"remove_liquidity","outputs":[],"inputs":[{"type":"uint256","name":"_amount"},{"type":"uint256[3]","name":"min_amounts"}],"stateMutability":"nonpayable","type":"function","gas":192846},{"name":"remove_liquidity_imbalance","outputs":[],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"uint256","name":"max_burn_amount"}],"stateMutability":"nonpayable","type":"function","gas":6951851},{"name":"calc_withdraw_one_coin","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"_token_amount"},{"type":"int128","name":"i"}],"stateMutability":"view","type":"function","gas":1102},{"name":"remove_liquidity_one_coin","outputs":[],"inputs":[{"type":"uint256","name":"_token_amount"},{"type":"int128","name":"i"},{"type":"uint256","name":"min_amount"}],"stateMutability":"nonpayable","type":"function","gas":4025523},{"name":"ramp_A","outputs":[],"inputs":[{"type":"uint256","name":"_future_A"},{"type":"uint256","name":"_future_time"}],"stateMutability":"nonpayable","type":"function","gas":151919},{"name":"stop_ramp_A","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":148637},{"name":"commit_new_fee","outputs":[],"inputs":[{"type":"uint256","name":"new_fee"},{"type":"uint256","name":"new_admin_fee"}],"stateMutability":"nonpayable","type":"function","gas":110461},{"name":"apply_new_fee","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":97242},{"name":"revert_new_parameters","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21895},{"name":"commit_transfer_ownership","outputs":[],"inputs":[{"type":"address","name":"_owner"}],"stateMutability":"nonpayable","type":"function","gas":74572},{"name":"apply_transfer_ownership","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":60710},{"name":"revert_transfer_ownership","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21985},{"name":"admin_balances","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"i"}],"stateMutability":"view","type":"function","gas":3481},{"name":"withdraw_admin_fees","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21502},{"name":"donate_admin_fees","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":111389},{"name":"kill_me","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":37998},{"name":"unkill_me","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":22135},{"name":"coins","outputs":[{"type":"address","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function","gas":2220},{"name":"balances","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function","gas":2250},{"name":"fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2171},{"name":"admin_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2201},{"name":"owner","outputs":[{"type":"address","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2231},{"name":"initial_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2261},{"name":"future_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2291},{"name":"initial_A_time","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2321},{"name":"future_A_time","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2351},{"name":"admin_actions_deadline","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2381},{"name":"transfer_ownership_deadline","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2411},{"name":"future_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2441},{"name":"future_admin_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2471},{"name":"future_owner","outputs":[{"type":"address","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2501}]
    )


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

def unlock(address):
    brownie.network.web3.provider.make_request('hardhat_impersonateAccount', [address])



def leading_whitespace(s, desired = 16):
    return ' ' * (desired-len(s)) + s

def commas(v, decimals = 18):
    """Pretty format token amounts as floored, fixed size dollars"""
    v = int(v / 10**decimals)
    s = f'{v:,}'
    return leading_whitespace(s, 16)

def c18(v):
    return commas(v, 18)

def c6(v):
    return commas(v, 6)

def show_vault_holdings():
    total = vault_core.totalValue()
    print("  Total: "+c18(vault_core.totalValue()))
    print("----------------------------------------")

    print("AAVE:  ", end='')
    print(c18(aave_strat.checkBalance(DAI))+ ' DAI    ', end='')
    print(c6(aave_strat.checkBalance(USDC))+ ' USDC   ', end='')
    print(c6(aave_strat.checkBalance(USDT))+ ' USDT   ')
    print("COMP:  ", end='')
    print(c18(comp_strat.checkBalance(DAI)) + ' DAI   ', end='')
    print(c6(comp_strat.checkBalance(USDC)) + ' USDC  ', end='')
    print(c6(comp_strat.checkBalance(USDT)) + ' USDT  ')
    print("Convex:", end='')
    convex_total = convex_strat.checkBalance(DAI) + convex_strat.checkBalance(USDC) * 1e12 + convex_strat.checkBalance(USDT) * 1e12
    convex_pct =  float(convex_total) / float(total) * 100
    print(c18(convex_total) + ' ({:0.2f}%)'.format(convex_pct))
    print("----------------------------------------")


def show_aave_rewards():
    print("==== AAVE Rewards ====")
    uncollected = aave_incentives_controller.getRewardsBalance(['0x028171bCA77440897B824Ca71D1c56caC55b68A3'], aave_strat)
    print("  AAVE Uncollected: "+c18(uncollected))
    timelocked = stkaave.balanceOf(AAVE_STRAT)
    print("   AAVE Timelocked: "+c18(timelocked))
    days_to_sell = -1 * (int(time.time()-stkaave.stakersCooldowns(aave_strat)) - stkaave.COOLDOWN_SECONDS()) / 60 / 60 / 24
    print("      Days to sell: {days_to_sell:16.2f}".format(days_to_sell=days_to_sell))


def create_gov_proposal(title, txs):
    tx = governor.propose(
        [x.receiver for x in txs],
        [x.sig_string for x in txs],
        ['0x'+x.input[10:] for x in txs],
        title,
        {'from': STRATEGIST}
    )
    tx.info()
    print("---------------------")
    print("Use these parameters to propose from metamask")
    print("TO: "+tx.receiver)
    print("DATA: "+tx.input)
    print("---------------------")

def sim_governor_execute(id):
    governor.queue(id, {'from': GOV_MULTISIG})
    brownie.chain.sleep(48*60*60+1)
    governor.execute(id, {'from': GOV_MULTISIG})
    print("Executed %s" % id)

class TemporaryFork:
    def __enter__(self):
        brownie.chain.snapshot()

    def __exit__(self, *args, **kwargs):
        brownie.chain.revert()

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
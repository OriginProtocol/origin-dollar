from world import *
# OETH proxy has already been deployed and wont change
OETH_PROXY = '0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3'
  
# configure these addresses below
FRAX_ETH_STRATEGY = '0xfB854832617CdE0eBe5EcE078e5D28ce9b7653C2'
OETH_VAULT_PROXY = '0x025C4DE2e9f91C39034C9A3661aCA70c55F65242'
# STOP custom configuration

frxeth = load_contract('ERC20', '0x5e8422345238f34275888049021821e8e08caa1f')
reth = load_contract('ERC20', '0xae78736Cd615f374D3085123A210448E74Fc6393')
oeth = load_contract('ousd', OETH_PROXY)

oeth_vault_admin = load_contract('vault_admin', OETH_VAULT_PROXY)
oeth_vault_core = load_contract('vault_core', OETH_VAULT_PROXY)
dev_oracle = load_contract('dev_oracle', oeth_vault_admin.priceProvider())

DUDE = '0x5Be876Ed0a9655133226BE302ca6f5503E3DA569'
RETH_DUDE = '0x5313b39bf226ced2332C81eB97BB28c6fD50d1a3'
unlock(DUDE)
unlock(RETH_DUDE)

def set_oracle_price(asset, price):
  feed = load_contract('mock_chainlink_feed', dev_oracle.getFeed(asset))
  feed.setPrice(price, {'from': GOV_MULTISIG})


ORACLEADDRESS = "0x1ce298Ec5FE0B1E4B04fb78d275Da6280f6e82A3"
# TODO
oeth_vault_admin.setStrategistAddr(DUDE, {'from': GOV_MULTISIG})


frxeth.approve(oeth_vault_admin, 1e70, {'from': DUDE})
oeth_vault_core.mint(frxeth, 2e18, 0, {'from': DUDE})

frax_eth_strat = load_contract('aave_strat', FRAX_ETH_STRATEGY)


# deposit and withdraw from Frax strategy
with TemporaryFork():
  oeth_vault_admin.depositToStrategy(FRAX_ETH_STRATEGY, [frxeth], [1e18], {'from': DUDE})
  print(frax_eth_strat.checkBalance(frxeth))
  oeth_vault_admin.withdrawFromStrategy(FRAX_ETH_STRATEGY, [frxeth], [1e18-1e3], {'from': DUDE})
  print(frax_eth_strat.checkBalance(frxeth))
  oeth_vault_admin.withdrawAllFromStrategy(FRAX_ETH_STRATEGY, {'from': DUDE})
  print(frax_eth_strat.checkBalance(frxeth))

# rebase and redeem and check oeth & vault supply
with TemporaryFork():
  print(oeth.totalSupply())
  print(oeth_vault_core.totalValue())
  oeth_vault_core.rebase({'from': DUDE})
  print(oeth.totalSupply())
  print(oeth_vault_core.totalValue())
  oeth_vault_core.redeem(1e18, 0, {'from': DUDE})
  print(oeth.totalSupply())
  print(oeth_vault_core.totalValue())

# mint with reth and change Oracle price negatively 
def mint_redeem_reth_w_oracle_price(amount, price_before_mint, price_before_redeem):
  with TemporaryFork():
    reth.approve(oeth_vault_admin, 1e70, {'from': RETH_DUDE})
    oeth_before = oeth.balanceOf(RETH_DUDE)
    reth_before = reth.balanceOf(RETH_DUDE)
    frxEth_before = frxeth.balanceOf(RETH_DUDE)
    set_oracle_price(reth.address, price_before_mint)
    oeth_vault_core.mint(reth, amount, 0, {'from': RETH_DUDE})
    oeth_diff = oeth.balanceOf(RETH_DUDE) - oeth_before
    print("OETH gained ", oeth_diff / 1e18)
    set_oracle_price(reth.address, price_before_redeem)
    oeth_vault_core.redeem(oeth_diff, 0, {'from': RETH_DUDE})
    oeth_diff_after = oeth.balanceOf(RETH_DUDE) - oeth_diff
    reth_diff = reth.balanceOf(RETH_DUDE) - reth_before
    frxEth_diff = frxeth.balanceOf(RETH_DUDE) - frxEth_before

    print("OETH net diff ", (oeth.balanceOf(RETH_DUDE) -  oeth_before) / 1e18)
    print("RETH net diff ", reth_diff / 1e18)
    print("frxEth net diff ", frxEth_diff / 1e18)

mint_redeem_reth_w_oracle_price(1e18, 1.3e18, 1.1e18)
mint_redeem_reth_w_oracle_price(1e18, 1.2e18, 1.2e18)
mint_redeem_reth_w_oracle_price(1e18, 1.1e18, 1.3e18)

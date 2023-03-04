from world import *
from brownie import interface, accounts

user1 = accounts.at("0x0000000000000000000000000000000000000001", force=True)
user2 = accounts.at("0x0000000000000000000000000000000000000002", force=True)

uni_usdc_usdt_proxy = "0xa863A50233FB5Aa5aFb515e6C3e6FB9c075AA594"
uni_usdc_usdt_strat = interface.GeneralizedUniswapV3Strategy(uni_usdc_usdt_proxy)

def get_some_balance(user):
  USDT_BAGS = '0x5754284f345afc66a98fbb0a0afe71e0f007b949'
  USDT_BAGS_2 = '0x5041ed759dd4afc3a72b8192c143f72f4724081a'
  USDC_BAGS = '0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf'
  USDC_BAGS_2 = '0x0a59649758aa4d66e25f08dd01271e891fe52199'

  usdt.transfer(user.address, int(usdt.balanceOf(USDT_BAGS) / 10), {'from': USDT_BAGS})
  # usdt.transfer(user.address, int(usdt.balanceOf(USDT_BAGS_2) / 10), {'from': USDT_BAGS_2})
  usdc.transfer(user.address, int(usdc.balanceOf(USDC_BAGS) / 10), {'from': USDC_BAGS})
  # usdc.transfer(user.address, int(usdc.balanceOf(USDC_BAGS_2) / 10), {'from': USDC_BAGS_2})

  usdt.approve(vault_core.address, int(0), {'from': user})
  usdc.approve(vault_core.address, int(0), {'from': user})
  print("Loaded wallets with some funds")

def set_as_default_strategy():
  vault_admin.setAssetDefaultStrategy(usdt.address, uni_usdc_usdt_proxy, {'from': TIMELOCK})
  vault_admin.setAssetDefaultStrategy(usdc.address, uni_usdc_usdt_proxy, {'from': TIMELOCK})
  print("Uniswap V3 set as default strategy")

def main():
  brownie.chain.snapshot()
  
  try:
    get_some_balance(user1)
    # get_some_balance(user2)

    set_as_default_strategy()

    print("Trying to mint")
    # vault_core.mint(usdt.address, 10000 * 1000000, 0, {'from': user1})
    vault_core.mint(usdc.address, 10000 * 1000000, 0, {'from': user1})
  except Exception as e:
    print("Exception", e)
  
  brownie.chain.revert()
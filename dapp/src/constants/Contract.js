export const currencies = {
  usdt: {
    localStorageSettingKey: 'usdt-manual-setting',
  },
  dai: {
    localStorageSettingKey: 'dai-manual-setting',
  },
  usdc: {
    localStorageSettingKey: 'usdc-manual-setting',
  },
}

export const gasLimits = {
  // redeem/redeemAll gas limit
  REDEEM_GAS_LIMIT: 3300000,
  // gas limit when the amount minted triggers the allocate function
  MINT_ALLOCATE_GAS_LIMIT: 3000000,
  // when the amount minted triggers the rebase function and not allocate function
  MINT_REBASE_GAS_LIMIT: 690000,
  // simple mint gas limit
  MINT_SIMPLE_GAS_LIMIT: 200000,
  // gas increase for each additional (non first) coin included in the mint transaction
  MINT_PER_COIN_GAS_INCREASE: 100000,
}

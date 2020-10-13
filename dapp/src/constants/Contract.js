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
  MINT_REBASE_GAS_LIMIT: 750000,
  // simple mint gas limit including 1 coin
  MINT_BASE_GAS_LIMIT: 250000,
  // gas increase for mint / mint + allocate / mint + rebase calls when 2 stablecoins are used to mint
  MINT_2_COIN_ADDITION_GAS_LIMIT: 300000,
  // gas increase for mint / mint + allocate / mint + rebase calls when 3 stablecoins are used to mint
  MINT_3_COIN_ADDITION_GAS_LIMIT: 350000,
}

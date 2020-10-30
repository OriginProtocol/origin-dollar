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
  // simple mint involving a single coin
  MINT_GAS_LIMIT: 201806,
  // simple mint involving multiple coins
  MINT_MULTIPLE_GAS_LIMIT: 475906,
  // when the amount minted using a single coin triggers the rebase function and not the allocate function
  MINT_REBASE_GAS_LIMIT: 749536,
  // when the amount minted using multiple coins triggers the rebase function and not the allocate function
  MINT_MULTIPLE_REBASE_GAS_LIMIT: 1039374,
  // when the amount minted using a single coin triggers the allocate function
  MINT_ALLOCATE_GAS_LIMIT: 3052725,
  // when the amount minted using multiple coins triggers the allocate function
  MINT_MULTIPLE_ALLOCATE_GAS_LIMIT: 3152725,
  // redeem/redeemAll gas limit
  REDEEM_GAS_LIMIT: 901968,
  // when the amount redeemed triggers the rebase function
  REDEEM_REBASE_GAS_LIMIT: 2028934,
}

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
  MINT_GAS_LIMIT: 184989,
  // simple mint involving multiple coins
  MINT_MULTIPLE_GAS_LIMIT: 436247,
  // when the amount minted using a single coin triggers the rebase function and not the allocate function
  MINT_REBASE_GAS_LIMIT: 687074,
  // when the amount minted using multiple coins triggers the rebase function and not the allocate function
  MINT_MULTIPLE_REBASE_GAS_LIMIT: 952760,
  // when the amount minted using a single coin triggers the allocate function
  MINT_ALLOCATE_GAS_LIMIT: 3404875,
  // when the amount minted using multiple coins triggers the allocate function
  MINT_MULTIPLE_ALLOCATE_GAS_LIMIT: 3704875,
  // redeem/redeemAll gas limit
  REDEEM_GAS_LIMIT: 826804,
  // when the amount redeemed triggers the rebase function
  REDEEM_REBASE_GAS_LIMIT: 1859856,
}

import { Store } from 'pullstate'

export const AccountStore = new Store({
  allowances: {},
  balances: {},
  // TODO: do not leave these ones hardcoded
  ousdExchangeRates: {
    dai: 1,
    usdt: 1,
    usdc: 1,
  },
  apr: undefined,
  establishingConnection: true,
  showLoginModal: false,
})

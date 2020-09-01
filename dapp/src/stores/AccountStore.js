import { Store } from 'pullstate'

export const AccountStore = new Store({
  allowances: {},
  balances: {},
  // TODO: do not leave these ones hardcoded
  ousdExchangeRates: {
  	'dai': 0.9654345654,
  	'usdt': 0.9654345654,
  	'usdc': 0.9654345654
  },
  establishingConnection: true,
  showLoginModal: false,
})

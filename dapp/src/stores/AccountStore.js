import { Store } from 'pullstate'

const AccountStore = new Store({
  allowances: {},
  balances: {},
  establishingConnection: true,
  showLoginModal: false,
  connectorIcon: null,
  // is user active / engaged with the dapp
  active: 'active', // active / idle
})

export default AccountStore

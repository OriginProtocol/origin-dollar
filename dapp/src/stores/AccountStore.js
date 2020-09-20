import { Store } from 'pullstate'

const AccountStore = new Store({
  allowances: {},
  balances: {},
  establishingConnection: true,
  showLoginModal: false,
  connectorIcon: null,
})

export default AccountStore

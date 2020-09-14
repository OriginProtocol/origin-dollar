import { Store } from 'pullstate'

const AccountStore = new Store({
  allowances: {},
  balances: {},
  apr: undefined,
  establishingConnection: true,
  showLoginModal: false,
  connectorIcon: null,
})

export default AccountStore

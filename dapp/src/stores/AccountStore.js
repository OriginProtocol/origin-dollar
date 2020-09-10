import { Store } from 'pullstate'

const AccountStore = new Store({
  allowances: {},
  balances: {},
  apr: undefined,
  establishingConnection: true,
  showLoginModal: false,
})

export default AccountStore

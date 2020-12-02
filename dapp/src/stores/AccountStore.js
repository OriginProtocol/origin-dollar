import { Store } from 'pullstate'

const AccountStore = new Store({
  allowances: {},
  balances: {},
  fetchAllowances: 3,
  establishingConnection: true,
  showLoginModal: false,
  connectorIcon: null,
  creditsBalanceOf: 0,
  // is user active / engaged with the dapp
  active: 'active', // active / idle
  /* instead of showing an add OUSD modal right afer mint we set this state to 'waiting'. Wait for the
   * OUSD balance animation to finish and then that animation sets this state to 'show'.
   */
  addOusdModalState: 'none',
})

export default AccountStore

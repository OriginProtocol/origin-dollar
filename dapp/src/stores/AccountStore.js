import { Store } from 'pullstate'

const AccountStore = new Store({
  // makes Account Listener refetch user data
  refetchUserData: false,
  refetchStakingData: false,
  allowances: {},
  balances: {},
  establishingConnection: true,
  walletSelectModalState: false,
  connectorName: null,
  creditsBalanceOf: 0,
  // is user active / engaged with the dapp
  active: 'active', // active / idle
  lifetimeYield: null,
})

export default AccountStore

import { Store } from 'pullstate'

const AccountStore = new Store({
  // makes Account Listener refetch user data
  refetchUserData: false,
  refetchStakingData: false,
  allowances: {},
  balances: {},
  wousdValue: 0,
  establishingConnection: true,
  walletSelectModalState: false,
  connectorName: null,
  creditsBalanceOf: 0,
  creditsWrapped: 0,
  // is user active / engaged with the dapp
  active: 'active', // active / idle
  lifetimeYield: null,
})

export default AccountStore

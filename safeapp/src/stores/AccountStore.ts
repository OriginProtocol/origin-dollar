import { Store } from 'pullstate'

interface IAccountStore {
  // makes Account Listener refetch user data
  refetchUserData: boolean,
  refetchStakingData: boolean,
  allowances: any,
  balances: any,
  establishingConnection: boolean,
  showLoginModal: boolean,
  connectorIcon: any,
  creditsBalanceOf: number,
  // is user active / engaged with the dapp
  active: string, // active / idle
  /* instead of showing an add OUSD modal right afer mint we set this state to 'waiting'. Wait for the
   * OUSD balance animation to finish and then that animation sets this state to 'show'.
   */
  addOusdModalState: string,
  // for local development only
  lm_allowances: any
}

const AccountStore = new Store<IAccountStore>({
  // makes Account Listener refetch user data
  refetchUserData: false,
  refetchStakingData: false,
  allowances: {},
  balances: {},
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
  // for local development only
  lm_allowances: {},
})

export default AccountStore

import AccountStore from 'stores/AccountStore'

import mixpanel from './mixpanel'
import { injected } from 'utils/connectors'
import { providerName } from 'utils/web3'
import { isMobileMetaMask } from 'utils/device'

export const walletLogin = (showLogin) => {
  const provider = providerName() || ''
  if (
    provider.match(
      'coinbase|imtoken|cipher|alphawallet|gowallet|trust|status|mist|parity'
    ) ||
    isMobileMetaMask()
  ) {
    activate(injected)
  } else if (showLogin) {
    showLogin()
  }
}

export const login = (address) => {
  AccountStore.update((s) => {
    s.address = address
  })

  mixpanel.alias(address)

  localStorage.setItem('eagerConnect', true)
}

export const logout = () => {
  AccountStore.update((s) => {
    s.address = null
    s.allowances = {}
    s.balances = {}
  })
}

export const refetchUserData = () => {
  AccountStore.update((s) => {
    s.refetchUserData = true
  })
}

export const refetchStakingData = () => {
  AccountStore.update((s) => {
    s.refetchStakingData = true
  })
}

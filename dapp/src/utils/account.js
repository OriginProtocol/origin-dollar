import AccountStore from 'stores/AccountStore'

import mixpanel from './mixpanel'

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

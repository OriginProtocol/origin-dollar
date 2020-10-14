import AccountStore from 'stores/AccountStore'

import mixpanel from './mixpanel'

export const login = (address, setCookie) => {
  AccountStore.update((s) => {
    s.address = address
  })

  mixpanel.alias(address)

  localStorage.setItem('eagerConnect', true)
  setCookie('loggedIn', address, { path: '/' })
}

export const logout = (removeCookie) => {
  AccountStore.update((s) => {
    s.address = null
    s.allowances = {}
    s.balances = {}
  })
  removeCookie('loggedIn')
}

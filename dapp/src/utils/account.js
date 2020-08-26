import { AccountStore } from 'stores/AccountStore'

export const login = (address, setCookie) => {
  AccountStore.update((s) => {
    s.address = address
  })

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

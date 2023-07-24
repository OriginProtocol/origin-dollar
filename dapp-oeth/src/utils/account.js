import AccountStore from 'stores/AccountStore'

export const login = (address) => {
  AccountStore.update((s) => {
    s.address = address
  })
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

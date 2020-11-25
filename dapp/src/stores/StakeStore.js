import { Store } from 'pullstate'

const StakeStore = new Store({
  totalPrincipal: null,
  totalCurrentInterest: null,
  stakes: [],
  ognAllowance: null,
  durations: null,
  rates: null,
})

export default StakeStore

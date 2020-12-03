import { Store } from 'pullstate'

const StakeStore = new Store({
  stakes: null,
  ognAllowance: null,
  durations: null,
  rates: null,
})

export default StakeStore

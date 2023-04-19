import { Store } from 'pullstate'

const StakeStore = new Store({
  stakes: null,
  airDropStakeClaimed: null,
  ognAllowance: null,
  durations: null,
  rates: null,
})

export default StakeStore

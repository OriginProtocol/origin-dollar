import { Store } from 'pullstate'

const StakeStore = new Store({
  totalPrincipal: null,
  totalCurrentInterest: null,
})

export default StakeStore

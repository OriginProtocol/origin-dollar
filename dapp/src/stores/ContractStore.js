import { Store } from 'pullstate'

const ContractStore = new Store({
  contracts: null,
  apr: null,
  ousdExchangeRates: {
    dai: 1,
    usdt: 1,
    usdc: 1,
  },
})

export default ContractStore

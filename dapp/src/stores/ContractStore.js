import { Store } from 'pullstate'

const ContractStore = new Store({
  contracts: null,
  apr: null,
  ousdExchangeRates: {
    dai: {
      mint: 1,
      redeem: 1,
    },
    usdt: {
      mint: 1,
      redeem: 1,
    },
    usdc: {
      mint: 1,
      redeem: 1,
    },
  },
})

export default ContractStore

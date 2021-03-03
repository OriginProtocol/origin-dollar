import { Store } from 'pullstate'


interface IContractStore {
  contracts: any,
  apy: any,
  ousdExchangeRates: any
}


const ContractStore = new Store<IContractStore>({
  contracts: null,
  apy: null,
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

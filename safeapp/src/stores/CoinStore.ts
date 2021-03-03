import { Store } from 'pullstate'

interface ICoinStore {
  ogn: object,
  ousd: object,
}

const CoinStore = new Store<ICoinStore>({
  ogn: {},
  ousd: {},
})

export default CoinStore

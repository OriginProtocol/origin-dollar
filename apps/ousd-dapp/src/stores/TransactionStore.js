import { Store } from 'pullstate'

export const initialState = {
  transactions: [], // mined [bool], observed [bool], hash [string], from [string], chainId [int], type [string]
  // newly arrived transactions. Can not include them into `transactions` since hooks cause too many race conditions
  dirtyTransactions: [],
  transactionHashesToDismiss: [],
  expandedTransaction: null,
}

const TransactionStore = new Store(initialState)

export default TransactionStore

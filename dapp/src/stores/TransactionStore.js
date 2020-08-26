import { Store } from 'pullstate'

export const initialState = {
  transactions: [],
  dirty: false,
}

export const TransactionStore = new Store(initialState)

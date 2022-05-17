import { useQuery } from 'react-query'

import { QUERY_KEYS } from '../constants/queryKeys'

import { transactionHistoryService } from '../services/transaction-history.service'

const useTransactionHistoryQuery = (account, transactionItems, options) => {
  return useQuery(
    QUERY_KEYS.TransactionHistory(account),
    () => transactionHistoryService.fetchHistory(account, transactionItems),
    {
      enabled: account != null && transactionItems != 0,
      refetchOnWindowFocus: false,
      ...options,
    }
  )
}

export default useTransactionHistoryQuery
